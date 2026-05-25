package main

import (
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"log"
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

	addr := fmt.Sprintf("%s:%d", bind, port)
	log.Printf("LinkHub SSH Server v1.0.0 listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}
