package main

import (
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

var (
	port  int
	token string
	bind  string
)

type Message struct {
	Type     string     `json:"type"`
	Data     string     `json:"data,omitempty"`
	Host     string     `json:"host,omitempty"`
	Port     int        `json:"port,omitempty"`
	Username string     `json:"username,omitempty"`
	Password string     `json:"password,omitempty"`
	Key      string     `json:"key,omitempty"`
	Cols     int        `json:"cols,omitempty"`
	Rows     int        `json:"rows,omitempty"`
	Token    string     `json:"token,omitempty"`
	Path     string     `json:"path,omitempty"`
	FileName string     `json:"fileName,omitempty"`
	FileData string     `json:"fileData,omitempty"`
	Files    []FileInfo `json:"files,omitempty"`
}

type FileInfo struct {
	Name  string `json:"name"`
	Size  int64  `json:"size"`
	IsDir bool   `json:"isDir"`
	Mode  string `json:"mode"`
	Time  string `json:"time"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
	HandshakeTimeout: 10 * time.Second,
}

type SSHSession struct {
	client     *ssh.Client
	session    *ssh.Session
	stdin      interface{ Write([]byte) (int, error) }
	sftpClient *sftp.Client
}

func (s *SSHSession) Close() {
	if s.sftpClient != nil {
		s.sftpClient.Close()
	}
	if s.session != nil {
		s.session.Close()
	}
	if s.client != nil {
		s.client.Close()
	}
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if rv := recover(); rv != nil {
			log.Printf("[recover] panic: %v", rv)
		}
	}()

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[error] WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	var sshSession *SSHSession
	authenticated := false
	remoteAddr := r.RemoteAddr
	var writeMu sync.Mutex
	closed := false

	log.Printf("[conn] new client: %s", remoteAddr)

	safeSend := func(msg Message) {
		if closed {
			return
		}
		writeMu.Lock()
		defer writeMu.Unlock()
		defer func() { recover() }()
		data, _ := json.Marshal(msg)
		conn.WriteMessage(websocket.TextMessage, data)
	}

	conn.SetReadDeadline(time.Now().Add(600 * time.Second))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(600 * time.Second))
		return nil
	})

	go func() {
		defer func() { recover() }()
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			if closed {
				return
			}
			writeMu.Lock()
			err := conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(10*time.Second))
			writeMu.Unlock()
			if err != nil {
				return
			}
		}
	}()

	for {
		conn.SetReadDeadline(time.Now().Add(600 * time.Second))
		_, msgBytes, err := conn.ReadMessage()
		if err != nil {
			log.Printf("[disconn] %s: %v", remoteAddr, err)
			break
		}

		var msg Message
		if err := json.Unmarshal(msgBytes, &msg); err != nil {
			continue
		}

		switch msg.Type {
		case "auth":
			if token != "" && msg.Token != token {
				safeSend(Message{Type: "error", Data: "auth failed"})
				log.Printf("[auth] %s failed", remoteAddr)
				conn.Close()
				return
			}
			authenticated = true
			safeSend(Message{Type: "auth_ok"})
			log.Printf("[auth] %s ok", remoteAddr)

		case "connect":
			if token != "" && !authenticated {
				safeSend(Message{Type: "error", Data: "please auth first"})
				continue
			}

			if sshSession != nil {
				sshSession.Close()
				sshSession = nil
			}

			sshHost := msg.Host
			if sshHost == "" {
				sshHost = "127.0.0.1"
			}
			sshPort := msg.Port
			if sshPort == 0 {
				sshPort = 22
			}

			var authMethods []ssh.AuthMethod
			if msg.Key != "" {
				signer, err := ssh.ParsePrivateKey([]byte(msg.Key))
				if err != nil {
					safeSend(Message{Type: "error", Data: "private key parse failed: " + err.Error()})
					continue
				}
				authMethods = append(authMethods, ssh.PublicKeys(signer))
			}
			if msg.Password != "" {
				authMethods = append(authMethods, ssh.Password(msg.Password))
			}
			if len(authMethods) == 0 {
				safeSend(Message{Type: "error", Data: "password or key required"})
				continue
			}

			config := &ssh.ClientConfig{
				User:            msg.Username,
				Auth:            authMethods,
				HostKeyCallback: ssh.InsecureIgnoreHostKey(),
				Timeout:         10 * time.Second,
			}

			addr := fmt.Sprintf("%s:%d", sshHost, sshPort)
			log.Printf("[ssh] connecting %s@%s", msg.Username, addr)

			client, err := ssh.Dial("tcp", addr, config)
			if err != nil {
				safeSend(Message{Type: "error", Data: "SSH connect failed: " + err.Error()})
				log.Printf("[ssh] connect failed %s: %v", addr, err)
				continue
			}

			session, err := client.NewSession()
			if err != nil {
				safeSend(Message{Type: "error", Data: "session create failed: " + err.Error()})
				client.Close()
				continue
			}

			cols := msg.Cols
			rows := msg.Rows
			if cols == 0 {
				cols = 120
			}
			if rows == 0 {
				rows = 40
			}

			modes := ssh.TerminalModes{
				ssh.ECHO:          1,
				ssh.TTY_OP_ISPEED: 14400,
				ssh.TTY_OP_OSPEED: 14400,
			}

			if err := session.RequestPty("xterm-256color", rows, cols, modes); err != nil {
				safeSend(Message{Type: "error", Data: "PTY request failed: " + err.Error()})
				session.Close()
				client.Close()
				continue
			}

			stdinPipe, _ := session.StdinPipe()
			stdoutPipe, _ := session.StdoutPipe()

			if err := session.Shell(); err != nil {
				safeSend(Message{Type: "error", Data: "shell start failed: " + err.Error()})
				session.Close()
				client.Close()
				continue
			}

			sshSession = &SSHSession{
				client:  client,
				session: session,
				stdin:   stdinPipe,
			}

			// 创建 SFTP 客户端
			sftpConn, err := sftp.NewClient(client)
			if err == nil {
				sshSession.sftpClient = sftpConn
				log.Printf("[sftp] client created for %s", addr)

				// 获取 home 目录（通过 exec）
				homeSession, herr := client.NewSession()
				home := ""
				if herr == nil {
					out, err := homeSession.Output("echo $HOME")
					homeSession.Close()
					if err == nil && len(out) > 0 {
						home = string(out)
						// 去掉换行符
						for len(home) > 0 && (home[len(home)-1] == '\n' || home[len(home)-1] == '\r') {
							home = home[:len(home)-1]
						}
					}
				}
				if home == "" {
					home = "/"
				}
				log.Printf("[sftp] home dir: %s", home)

				// 推送初始文件列表
				entries, listErr := sftpConn.ReadDir(home)
				if listErr == nil {
					var files []FileInfo
					for _, entry := range entries {
						files = append(files, FileInfo{
							Name:  entry.Name(),
							Size:  entry.Size(),
							IsDir: entry.IsDir(),
							Mode:  entry.Mode().String(),
							Time:  entry.ModTime().Format("2006-01-02 15:04:05"),
						})
					}
					safeSend(Message{Type: "dirList", Path: home, Files: files})
				} else {
					log.Printf("[sftp] initial list failed: %v", listErr)
					safeSend(Message{Type: "error", Data: "list dir failed: " + listErr.Error()})
				}
			} else {
				log.Printf("[sftp] failed to create client: %v", err)
			}

			safeSend(Message{Type: "connected", Data: addr})
			log.Printf("[ssh] connected %s@%s", msg.Username, addr)

			go func() {
				defer func() { recover() }()
				buf := make([]byte, 8192)
				for {
					n, err := stdoutPipe.Read(buf)
					if err != nil {
						safeSend(Message{Type: "disconnect", Data: "SSH disconnected"})
						log.Printf("[ssh] disconnected %s", addr)
						return
					}
					if n > 0 {
						output := string(buf[:n])

						// 检测 CWD 标记并提取路径
						for {
							start := indexOf(output, "__LINKHUB_CWD_START__")
							if start == -1 {
								break
							}
							end := indexOf(output[start:], "__LINKHUB_CWD_END__")
							if end == -1 {
								break
							}
							cwd := output[start+21 : start+end]
							safeSend(Message{Type: "cwd", Data: cwd})
							// 移除标记行（包括前面的 echo 命令和换行）
							lineStart := start
							for lineStart > 0 && output[lineStart-1] != '\n' {
								lineStart--
							}
							lineEnd := start + end + 19
							for lineEnd < len(output) && output[lineEnd] != '\n' {
								lineEnd++
							}
							if lineEnd < len(output) {
								lineEnd++ // 包含换行符
							}
							output = output[:lineStart] + output[lineEnd:]
						}

						// 也移除 echo 命令本身的回显
						for {
							echoStart := indexOf(output, "echo __LINKHUB_CWD_START__$(pwd)__LINKHUB_CWD_END__")
							if echoStart == -1 {
								break
							}
							echoEnd := echoStart + 51
							// 找到这行的开始和结束
							lineStart := echoStart
							for lineStart > 0 && output[lineStart-1] != '\n' {
								lineStart--
							}
							lineEnd := echoEnd
							for lineEnd < len(output) && output[lineEnd] != '\n' {
								lineEnd++
							}
							if lineEnd < len(output) {
								lineEnd++
							}
							output = output[:lineStart] + output[lineEnd:]
						}

						if len(output) > 0 {
							safeSend(Message{Type: "output", Data: output})
						}
					}
				}
			}()

		case "input":
			if sshSession != nil && sshSession.stdin != nil {
				sshSession.stdin.Write([]byte(msg.Data))
			}

		case "resize":
			if sshSession != nil && sshSession.session != nil && msg.Cols > 0 && msg.Rows > 0 {
				sshSession.session.WindowChange(msg.Rows, msg.Cols)
			}

		case "listDir":
			if sshSession == nil || sshSession.sftpClient == nil {
				safeSend(Message{Type: "error", Data: "SFTP not connected"})
				continue
			}
			dirPath := msg.Path
			log.Printf("[sftp] listDir request: %q", dirPath)
			if dirPath == "" || dirPath == "." {
				// 获取 home 目录
				homeSession, herr := sshSession.client.NewSession()
				if herr == nil {
					out, err := homeSession.Output("echo $HOME")
					homeSession.Close()
					if err == nil && len(out) > 0 {
						dirPath = string(out)
						for len(dirPath) > 0 && (dirPath[len(dirPath)-1] == '\n' || dirPath[len(dirPath)-1] == '\r') {
							dirPath = dirPath[:len(dirPath)-1]
						}
					}
				}
				if dirPath == "" || dirPath == "." {
					dirPath = "/"
				}
			}
			entries, err := sshSession.sftpClient.ReadDir(dirPath)
			if err != nil {
				log.Printf("[sftp] ReadDir failed for %q: %v", dirPath, err)
				safeSend(Message{Type: "error", Data: "list dir failed: " + err.Error()})
				continue
			}
			var files []FileInfo
			for _, entry := range entries {
				files = append(files, FileInfo{
					Name:  entry.Name(),
					Size:  entry.Size(),
					IsDir: entry.IsDir(),
					Mode:  entry.Mode().String(),
					Time:  entry.ModTime().Format("2006-01-02 15:04:05"),
				})
			}
			safeSend(Message{Type: "dirList", Path: dirPath, Files: files})

		case "getCwd":
			if sshSession == nil || sshSession.stdin == nil {
				continue
			}
			// 通过 shell stdin 注入一个隐藏的 pwd 命令
			// 使用特殊标记包裹，在 stdout 中检测
			sshSession.stdin.Write([]byte("echo __LINKHUB_CWD_START__$(pwd)__LINKHUB_CWD_END__\n"))

		case "getSysInfo":
			if sshSession == nil || sshSession.client == nil {
				continue
			}
			go func() {
				defer func() { recover() }()
				infoSession, err := sshSession.client.NewSession()
				if err != nil {
					return
				}
				cmd := "echo \"{\\\"os\\\":\\\"$(lsb_release -ds 2>/dev/null || cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '\\\"' || uname -s)\\\",\\\"cpu\\\":\\\"$(nproc) 核\\\",\\\"mem\\\":\\\"$(free -h | awk '/Mem:/{print $2}') 内存\\\",\\\"disk\\\":\\\"$(df -h / | awk 'NR==2{print $2}') 硬盘\\\"}\""
				out, err := infoSession.Output(cmd)
				infoSession.Close()
				if err != nil {
					return
				}
				result := string(out)
				for len(result) > 0 && (result[len(result)-1] == '\n' || result[len(result)-1] == '\r') {
					result = result[:len(result)-1]
				}
				safeSend(Message{Type: "sysInfo", Data: result})
			}()

		case "upload":
			if sshSession == nil || sshSession.sftpClient == nil {
				safeSend(Message{Type: "error", Data: "SFTP not connected"})
				continue
			}
			remotePath := msg.Path + "/" + msg.FileName
			decoded, err := base64Decode(msg.FileData)
			if err != nil {
				safeSend(Message{Type: "error", Data: "decode file failed: " + err.Error()})
				continue
			}
			f, err := sshSession.sftpClient.Create(remotePath)
			if err != nil {
				safeSend(Message{Type: "error", Data: "create file failed: " + err.Error()})
				continue
			}
			_, err = f.Write(decoded)
			f.Close()
			if err != nil {
				safeSend(Message{Type: "error", Data: "write file failed: " + err.Error()})
				continue
			}
			safeSend(Message{Type: "uploadOk", Data: remotePath})

		case "uploadChunk":
			if sshSession == nil || sshSession.sftpClient == nil {
				safeSend(Message{Type: "error", Data: "SFTP not connected"})
				continue
			}
			remotePath := msg.Path + "/" + msg.FileName
			decoded, err := base64Decode(msg.FileData)
			if err != nil {
				safeSend(Message{Type: "error", Data: "upload decode failed: " + err.Error()})
				continue
			}
			// 解析 chunk 信息: "currentChunk/totalChunks"
			isFirstChunk := false
			if len(msg.Data) > 0 && msg.Data[0] == '0' {
				isFirstChunk = true
			}
			var f *sftp.File
			if isFirstChunk {
				f, err = sshSession.sftpClient.Create(remotePath)
			} else {
				f, err = sshSession.sftpClient.OpenFile(remotePath, os.O_WRONLY|os.O_APPEND)
			}
			if err != nil {
				safeSend(Message{Type: "error", Data: "upload open failed: " + err.Error()})
				continue
			}
			_, err = f.Write(decoded)
			f.Close()
			if err != nil {
				safeSend(Message{Type: "error", Data: "upload write failed: " + err.Error()})
				continue
			}

		case "rename":
			if sshSession == nil || sshSession.sftpClient == nil {
				safeSend(Message{Type: "error", Data: "SFTP not connected"})
				continue
			}
			oldPath := msg.Path
			newPath := msg.Data
			err := sshSession.sftpClient.Rename(oldPath, newPath)
			if err != nil {
				safeSend(Message{Type: "error", Data: "rename failed: " + err.Error()})
				continue
			}
			safeSend(Message{Type: "renameOk", Data: newPath})

		case "disconnect":
			if sshSession != nil {
				sshSession.Close()
				sshSession = nil
			}
			safeSend(Message{Type: "disconnected"})
			log.Printf("[ssh] manual disconnect %s", remoteAddr)
		}
	}

	closed = true
	if sshSession != nil {
		sshSession.Close()
	}
	log.Printf("[conn] client left: %s", remoteAddr)
}

func base64Decode(s string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(s)
}

func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

func main() {
	action := flag.String("action", "run", "action: run, install, uninstall")
	flag.IntVar(&port, "port", 18022, "listen port")
	flag.StringVar(&token, "token", "", "auth token")
	flag.StringVar(&bind, "bind", "0.0.0.0", "bind address")
	flag.Parse()

	switch *action {
	case "install":
		installAutoStart()
	case "uninstall":
		uninstallAutoStart()
	default:
		runServer()
	}
}

func installAutoStart() {
	if runtime.GOOS != "windows" {
		fmt.Println("This feature is for Windows only. Use systemd on Linux.")
		return
	}

	exePath, err := os.Executable()
	if err != nil {
		fmt.Printf("Failed to get exe path: %v\n", err)
		return
	}
	exePath, _ = filepath.Abs(exePath)

	startupDir := filepath.Join(os.Getenv("APPDATA"), "Microsoft", "Windows", "Start Menu", "Programs", "Startup")

	vbsPath := filepath.Join(startupDir, "LinkHubSSH.vbs")
	vbsContent := fmt.Sprintf("Set WshShell = CreateObject(\"WScript.Shell\")\nWshShell.Run \"\"\"%s\"\" -action run\", 0, False", exePath)

	err = os.WriteFile(vbsPath, []byte(vbsContent), 0644)
	if err != nil {
		fmt.Printf("Install failed: %v\n", err)
		return
	}

	fmt.Println("OK! Installed successfully.")
	fmt.Printf("  Startup script: %s\n", vbsPath)
	fmt.Println("  Starting service now...")

	cmd := exec.Command("wscript", vbsPath)
	cmd.Start()

	fmt.Println("OK! Service started. You can close this window.")
}

func uninstallAutoStart() {
	if runtime.GOOS != "windows" {
		fmt.Println("This feature is for Windows only.")
		return
	}

	startupDir := filepath.Join(os.Getenv("APPDATA"), "Microsoft", "Windows", "Start Menu", "Programs", "Startup")
	vbsPath := filepath.Join(startupDir, "LinkHubSSH.vbs")

	err := os.Remove(vbsPath)
	if err != nil {
		if os.IsNotExist(err) {
			fmt.Println("Not installed.")
		} else {
			fmt.Printf("Uninstall failed: %v\n", err)
		}
		return
	}

	fmt.Println("OK! Uninstalled.")
}

func runServer() {
	// 写日志到文件（方便排查问题）
	exePath, _ := os.Executable()
	logPath := filepath.Join(filepath.Dir(exePath), "linkhub-ssh.log")
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err == nil {
		log.SetOutput(logFile)
	}

	http.HandleFunc("/ws", handleWebSocket)

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "version": "1.0.0"})
	})

	// HTTP 文件下载接口
	http.HandleFunc("/download", handleDownload)

	// Ping 接口（检测远程服务器 SSH 端口是否可达）
	http.HandleFunc("/ping", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "application/json")
		host := r.URL.Query().Get("host")
		portStr := r.URL.Query().Get("port")
		if host == "" {
			json.NewEncoder(w).Encode(map[string]interface{}{"ok": false})
			return
		}
		port := "22"
		if portStr != "" {
			port = portStr
		}
		start := time.Now()
		conn, err := net.DialTimeout("tcp", host+":"+port, 3*time.Second)
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"ok": false, "latency": 0})
			return
		}
		conn.Close()
		latency := time.Since(start).Milliseconds()
		json.NewEncoder(w).Encode(map[string]interface{}{"ok": true, "latency": latency})
	})

	addr := fmt.Sprintf("%s:%d", bind, port)
	log.Printf("LinkHub SSH Server v1.0.0 listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}

// HTTP 下载处理
func handleDownload(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")

	host := r.URL.Query().Get("host")
	portStr := r.URL.Query().Get("port")
	username := r.URL.Query().Get("username")
	password := r.URL.Query().Get("password")
	filePath := r.URL.Query().Get("path")
	isDir := r.URL.Query().Get("isDir")

	if host == "" || username == "" || filePath == "" {
		http.Error(w, "missing parameters", 400)
		return
	}

	sshPort := 22
	if portStr != "" {
		fmt.Sscanf(portStr, "%d", &sshPort)
	}

	// 建立 SSH 连接
	config := &ssh.ClientConfig{
		User:            username,
		Auth:            []ssh.AuthMethod{ssh.Password(password)},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", host, sshPort)
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		http.Error(w, "SSH connect failed: "+err.Error(), 500)
		return
	}
	defer client.Close()

	if isDir == "true" {
		// 文件夹：tar 打包流式传输
		session, err := client.NewSession()
		if err != nil {
			http.Error(w, "session failed: "+err.Error(), 500)
			return
		}
		defer session.Close()

		stdout, err := session.StdoutPipe()
		if err != nil {
			http.Error(w, "stdout pipe failed", 500)
			return
		}

		// 获取文件夹名作为下载文件名
		parts := splitPath(filePath)
		fileName := parts[len(parts)-1] + ".tar.gz"

		w.Header().Set("Content-Type", "application/gzip")
		w.Header().Set("Content-Disposition", "attachment; filename=\""+fileName+"\"")

		err = session.Start("tar czf - -C \"" + filePath + "\" .")
		if err != nil {
			http.Error(w, "tar failed: "+err.Error(), 500)
			return
		}

		buf := make([]byte, 64*1024)
		for {
			n, err := stdout.Read(buf)
			if n > 0 {
				w.Write(buf[:n])
				if f, ok := w.(http.Flusher); ok {
					f.Flush()
				}
			}
			if err != nil {
				break
			}
		}
		session.Wait()
	} else {
		// 文件：通过 SFTP 流式读取
		sftpClient, err := sftp.NewClient(client)
		if err != nil {
			http.Error(w, "SFTP failed: "+err.Error(), 500)
			return
		}
		defer sftpClient.Close()

		f, err := sftpClient.Open(filePath)
		if err != nil {
			http.Error(w, "open file failed: "+err.Error(), 500)
			return
		}
		defer f.Close()

		stat, _ := f.Stat()
		parts := splitPath(filePath)
		fileName := parts[len(parts)-1]

		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Disposition", "attachment; filename=\""+fileName+"\"")
		if stat != nil {
			w.Header().Set("Content-Length", fmt.Sprintf("%d", stat.Size()))
		}

		buf := make([]byte, 64*1024)
		for {
			n, err := f.Read(buf)
			if n > 0 {
				w.Write(buf[:n])
				if flusher, ok := w.(http.Flusher); ok {
					flusher.Flush()
				}
			}
			if err != nil {
				break
			}
		}
	}
}

func splitPath(path string) []string {
	var parts []string
	for _, p := range filepath.SplitList(path) {
		parts = append(parts, p)
	}
	// 简单按 / 分割
	result := []string{}
	for _, p := range split(path, '/') {
		if p != "" {
			result = append(result, p)
		}
	}
	if len(result) == 0 {
		return []string{"download"}
	}
	return result
}

func split(s string, sep byte) []string {
	var parts []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == sep {
			if i > start {
				parts = append(parts, s[start:i])
			}
			start = i + 1
		}
	}
	if start < len(s) {
		parts = append(parts, s[start:])
	}
	return parts
}
