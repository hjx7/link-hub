package main

import (
	"bytes"
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
	"strconv"
	"strings"
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

const (
	linkhubCwdOSC       = "\x1b]777;linkhub-cwd:"
	linkhubCwdBEL       = "\x07"
	linkhubInstallShell = `__linkhub_report_cwd(){ printf '\033]777;linkhub-cwd:%s\007' "$PWD"; }; if [ -n "$ZSH_VERSION" ]; then autoload -Uz add-zsh-hook 2>/dev/null; if command -v add-zsh-hook >/dev/null 2>&1; then add-zsh-hook precmd __linkhub_report_cwd 2>/dev/null; else precmd_functions+=(__linkhub_report_cwd); fi; elif [ -n "$BASH_VERSION" ]; then case ";$PROMPT_COMMAND;" in *";__linkhub_report_cwd;"*) ;; *) PROMPT_COMMAND="__linkhub_report_cwd${PROMPT_COMMAND:+;$PROMPT_COMMAND}";; esac; else PS1='$( __linkhub_report_cwd )'"$PS1"; fi; __linkhub_report_cwd`
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

func stripLineContaining(output, needle string) string {
	for {
		pos := strings.Index(output, needle)
		if pos == -1 {
			return output
		}
		lineStart := pos
		for lineStart > 0 && output[lineStart-1] != '\n' && output[lineStart-1] != '\r' {
			lineStart--
		}
		lineEnd := pos + len(needle)
		for lineEnd < len(output) && output[lineEnd] != '\n' && output[lineEnd] != '\r' {
			lineEnd++
		}
		for lineEnd < len(output) && (output[lineEnd] == '\n' || output[lineEnd] == '\r') {
			lineEnd++
		}
		output = output[:lineStart] + output[lineEnd:]
	}
}

func extractCwdReports(output string, safeSend func(Message)) (string, string) {
	pending := ""

	if start := strings.LastIndex(output, linkhubCwdOSC); start != -1 {
		if strings.Index(output[start:], linkhubCwdBEL) == -1 {
			pending = output[start:]
			output = output[:start]
		}
	}

	for {
		start := strings.Index(output, linkhubCwdOSC)
		if start == -1 {
			break
		}
		end := strings.Index(output[start+len(linkhubCwdOSC):], linkhubCwdBEL)
		if end == -1 {
			pending = output[start:]
			output = output[:start]
			break
		}
		cwdStart := start + len(linkhubCwdOSC)
		cwdEnd := cwdStart + end
		cwd := output[cwdStart:cwdEnd]
		if cwd != "" {
			safeSend(Message{Type: "cwd", Data: cwd})
		}
		output = output[:start] + output[cwdEnd+len(linkhubCwdBEL):]
	}

	return output, pending
}

func shellQuote(s string) string {
	if s == "" {
		return "''"
	}
	return "'" + strings.ReplaceAll(s, "'", "'\"'\"'") + "'"
}

func runSSHCommand(client *ssh.Client, command string) ([]byte, error) {
	session, err := client.NewSession()
	if err != nil {
		return nil, err
	}
	defer session.Close()
	return session.CombinedOutput(command)
}

func runSSHCommandWithInput(client *ssh.Client, command string, input []byte) ([]byte, error) {
	session, err := client.NewSession()
	if err != nil {
		return nil, err
	}
	defer session.Close()
	session.Stdin = bytes.NewReader(input)
	return session.CombinedOutput(command)
}

func sudoCommand(command string) string {
	return "sudo -n sh -c " + shellQuote(command)
}

func getRemoteHome(client *ssh.Client) string {
	out, err := runSSHCommand(client, "printf %s \"$HOME\"")
	if err != nil || len(out) == 0 {
		return "/"
	}
	home := strings.TrimSpace(string(out))
	if home == "" {
		return "/"
	}
	return home
}

func sudoRealPath(client *ssh.Client, path string) (string, error) {
	if path == "" || path == "." {
		path = getRemoteHome(client)
	}
	cmd := sudoCommand("realpath -- " + shellQuote(path))
	out, err := runSSHCommand(client, cmd)
	if err != nil {
		return "", fmt.Errorf("%s", strings.TrimSpace(string(out)))
	}
	realPath := strings.TrimSpace(string(out))
	if realPath == "" {
		return path, nil
	}
	return realPath, nil
}

func sudoListDir(client *ssh.Client, dirPath string) (string, []FileInfo, error) {
	realPath, err := sudoRealPath(client, dirPath)
	if err != nil {
		return "", nil, fmt.Errorf("sudo list dir failed: %v", err)
	}

	cmd := sudoCommand("find " + shellQuote(realPath) + " -mindepth 1 -maxdepth 1 -printf '%f\\t%s\\t%y\\t%M\\t%TY-%Tm-%Td %TH:%TM:%TS\\n'")
	out, err := runSSHCommand(client, cmd)
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return "", nil, fmt.Errorf("sudo list dir failed: %s", msg)
	}

	var files []FileInfo
	lines := strings.Split(strings.TrimRight(string(out), "\n"), "\n")
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		parts := strings.SplitN(line, "\t", 5)
		if len(parts) < 5 {
			continue
		}
		size, _ := strconv.ParseInt(parts[1], 10, 64)
		files = append(files, FileInfo{
			Name:  parts[0],
			Size:  size,
			IsDir: parts[2] == "d",
			Mode:  parts[3],
			Time:  parts[4],
		})
	}
	return realPath, files, nil
}

func sudoReadFile(client *ssh.Client, filePath string) (string, error) {
	const maxSize = 2 * 1024 * 1024
	cmd := sudoCommand("size=$(stat -c %s -- " + shellQuote(filePath) + ") || exit 1; if [ \"$size\" -gt " + fmt.Sprintf("%d", maxSize) + " ]; then head -c " + fmt.Sprintf("%d", maxSize) + " -- " + shellQuote(filePath) + " | base64 -w0; else base64 -w0 -- " + shellQuote(filePath) + "; fi")
	out, err := runSSHCommand(client, cmd)
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return "", fmt.Errorf("sudo read file failed: %s", msg)
	}
	data, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(out)))
	if err != nil {
		return "", fmt.Errorf("sudo read file decode failed: %v", err)
	}
	return string(data), nil
}

func sudoWriteFile(client *ssh.Client, filePath, content string) error {
	encoded := []byte(base64.StdEncoding.EncodeToString([]byte(content)))
	cmd := "base64 -d | sudo -n tee -- " + shellQuote(filePath) + " >/dev/null"
	out, err := runSSHCommandWithInput(client, "sh -c "+shellQuote(cmd), encoded)
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("sudo write file failed: %s", msg)
	}
	return nil
}

func sudoRename(client *ssh.Client, oldPath, newPath string) error {
	cmd := sudoCommand("mv -- " + shellQuote(oldPath) + " " + shellQuote(newPath))
	out, err := runSSHCommand(client, cmd)
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("sudo rename failed: %s", msg)
	}
	return nil
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

			// 设置环境变量以启用颜色输出
			session.Setenv("TERM", "xterm-256color")
			session.Setenv("COLORTERM", "truecolor")

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

				// 推送初始文件列表（文件管理默认使用 sudo）
				listPath, files, listErr := sudoListDir(client, home)
				if listErr == nil {
					safeSend(Message{Type: "dirList", Path: listPath, Files: files})
				} else {
					log.Printf("[sudo] initial list failed: %v", listErr)
					safeSend(Message{Type: "error", Data: listErr.Error()})
				}
			} else {
				log.Printf("[sftp] failed to create client: %v", err)
			}

			safeSend(Message{Type: "connected", Data: addr})
			log.Printf("[ssh] connected %s@%s", msg.Username, addr)

			go func() {
				defer func() { recover() }()
				buf := make([]byte, 8192)
				pendingOutput := "" // 缓存可能包含不完整 CWD 标记的输出
				for {
					n, err := stdoutPipe.Read(buf)
					if err != nil {
						safeSend(Message{Type: "disconnect", Data: "SSH disconnected"})
						log.Printf("[ssh] disconnected %s", addr)
						return
					}
					if n > 0 {
						output := pendingOutput + string(buf[:n])
						pendingOutput = ""

						output = stripLineContaining(output, linkhubInstallShell)
						var oscPending string
						output, oscPending = extractCwdReports(output, safeSend)
						if oscPending != "" {
							pendingOutput = oscPending
						}

						if len(output) > 0 {
							safeSend(Message{Type: "output", Data: output})
						}
					}
				}
			}()

			go func() {
				time.Sleep(300 * time.Millisecond)
				if sshSession != nil && sshSession.stdin != nil {
					sshSession.stdin.Write([]byte(linkhubInstallShell + "\n"))
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
			if sshSession == nil || sshSession.client == nil {
				safeSend(Message{Type: "error", Data: "SSH not connected"})
				continue
			}
			dirPath := msg.Path
			log.Printf("[sudo] listDir request: %q", dirPath)
			listPath, files, err := sudoListDir(sshSession.client, dirPath)
			if err != nil {
				log.Printf("[sudo] listDir failed for %q: %v", dirPath, err)
				safeSend(Message{Type: "error", Data: err.Error()})
				continue
			}
			safeSend(Message{Type: "dirList", Path: listPath, Files: files})

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
			if sshSession == nil || sshSession.client == nil {
				safeSend(Message{Type: "error", Data: "SSH not connected"})
				continue
			}
			remotePath := msg.Path + "/" + msg.FileName
			decoded, err := base64Decode(msg.FileData)
			if err != nil {
				safeSend(Message{Type: "error", Data: "decode file failed: " + err.Error()})
				continue
			}
			if err := sudoWriteFile(sshSession.client, remotePath, string(decoded)); err != nil {
				safeSend(Message{Type: "error", Data: err.Error()})
				continue
			}
			safeSend(Message{Type: "uploadOk", Data: remotePath})

		case "uploadChunk":
			if sshSession == nil || sshSession.client == nil {
				safeSend(Message{Type: "error", Data: "SSH not connected"})
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
			tmpName := "/tmp/linkhub-upload-" + base64.RawURLEncoding.EncodeToString([]byte(remotePath))
			writeCmd := "tmp=" + shellQuote(tmpName) + "; "
			if isFirstChunk {
				writeCmd += ": > \"$tmp\" || exit 1; "
			}
			writeCmd += "base64 -d >> \"$tmp\""
			_, err = runSSHCommandWithInput(sshSession.client, "sh -c "+shellQuote(writeCmd), []byte(base64.StdEncoding.EncodeToString(decoded)))
			if err != nil {
				safeSend(Message{Type: "error", Data: "upload write failed: " + err.Error()})
				continue
			}
			if strings.Contains(msg.Data, "/") {
				parts := strings.SplitN(msg.Data, "/", 2)
				chunk, _ := strconv.Atoi(parts[0])
				totalChunks, _ := strconv.Atoi(parts[1])
				if totalChunks > 0 && chunk >= totalChunks-1 {
					finalCmd := "tmp=" + shellQuote(tmpName) + "; sudo -n install -m 0644 \"$tmp\" " + shellQuote(remotePath) + "; status=$?; rm -f \"$tmp\"; exit $status"
					out, err := runSSHCommand(sshSession.client, "sh -c "+shellQuote(finalCmd))
					if err != nil {
						msgText := strings.TrimSpace(string(out))
						if msgText == "" {
							msgText = err.Error()
						}
						safeSend(Message{Type: "error", Data: "sudo upload failed: " + msgText})
						continue
					}
					safeSend(Message{Type: "uploadOk", Data: remotePath})
				}
			}

		case "rename":
			if sshSession == nil || sshSession.client == nil {
				safeSend(Message{Type: "error", Data: "SSH not connected"})
				continue
			}
			oldPath := msg.Path
			newPath := msg.Data
			if err := sudoRename(sshSession.client, oldPath, newPath); err != nil {
				safeSend(Message{Type: "error", Data: err.Error()})
				continue
			}
			safeSend(Message{Type: "renameOk", Data: newPath})

		case "readFile":
			if sshSession == nil || sshSession.client == nil {
				safeSend(Message{Type: "error", Data: "SSH not connected"})
				continue
			}
			filePath := msg.Path
			if filePath == "" {
				safeSend(Message{Type: "error", Data: "readFile: path is empty"})
				continue
			}
			content, err := sudoReadFile(sshSession.client, filePath)
			if err != nil {
				safeSend(Message{Type: "error", Data: err.Error()})
				continue
			}
			safeSend(Message{Type: "fileContent", Path: filePath, Data: content})

		case "writeFile":
			if sshSession == nil || sshSession.client == nil {
				safeSend(Message{Type: "error", Data: "SSH not connected"})
				continue
			}
			filePath := msg.Path
			if filePath == "" {
				safeSend(Message{Type: "error", Data: "writeFile: path is empty"})
				continue
			}
			if err := sudoWriteFile(sshSession.client, filePath, msg.Data); err != nil {
				safeSend(Message{Type: "error", Data: err.Error()})
				continue
			}
			safeSend(Message{Type: "writeFileOk", Path: filePath})

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
	return strings.Index(s, substr)
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

	// HTTP 文件上传接口
	http.HandleFunc("/upload", handleUpload)

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

	// 批量执行命令接口
	http.HandleFunc("/exec", handleExec)

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

		err = session.Start(sudoCommand("tar czf - -C " + shellQuote(filePath) + " ."))
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
		parts := splitPath(filePath)
		fileName := parts[len(parts)-1]

		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Disposition", "attachment; filename=\""+fileName+"\"")

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

		err = session.Start(sudoCommand("cat -- " + shellQuote(filePath)))
		if err != nil {
			http.Error(w, "cat failed: "+err.Error(), 500)
			return
		}

		buf := make([]byte, 64*1024)
		for {
			n, err := stdout.Read(buf)
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
		session.Wait()
	}
}

// HTTP 上传处理（分片，复用连接）
func handleUpload(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(200)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "method not allowed", 405)
		return
	}

	r.ParseMultipartForm(10 << 20)

	host := r.FormValue("host")
	portStr := r.FormValue("port")
	username := r.FormValue("username")
	password := r.FormValue("password")
	remotePath := r.FormValue("path")
	chunkStr := r.FormValue("chunk")
	totalChunksStr := r.FormValue("totalChunks")

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "file read failed: "+err.Error(), 400)
		return
	}
	defer file.Close()

	sshPort := 22
	if portStr != "" {
		fmt.Sscanf(portStr, "%d", &sshPort)
	}

	chunk := 0
	fmt.Sscanf(chunkStr, "%d", &chunk)
	totalChunks := 1
	fmt.Sscanf(totalChunksStr, "%d", &totalChunks)

	remoteFile := remotePath + "/" + header.Filename

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

	data := new(bytes.Buffer)
	if _, err := data.ReadFrom(file); err != nil {
		http.Error(w, "file read failed: "+err.Error(), 500)
		return
	}

	tmpName := "/tmp/linkhub-upload-" + base64.RawURLEncoding.EncodeToString([]byte(remoteFile))
	writeCmd := "tmp=" + shellQuote(tmpName) + "; "
	if chunk == 0 {
		writeCmd += ": > \"$tmp\" || exit 1; "
	}
	writeCmd += "base64 -d >> \"$tmp\""
	if _, err := runSSHCommandWithInput(client, "sh -c "+shellQuote(writeCmd), []byte(base64.StdEncoding.EncodeToString(data.Bytes()))); err != nil {
		http.Error(w, "upload write failed: "+err.Error(), 500)
		return
	}

	// 最后一片，关闭会话
	if chunk >= totalChunks-1 {
		finalCmd := "tmp=" + shellQuote(tmpName) + "; cat \"$tmp\" | sudo -n tee -- " + shellQuote(remoteFile) + " >/dev/null; status=$?; rm -f \"$tmp\"; exit $status"
		out, err := runSSHCommand(client, "sh -c "+shellQuote(finalCmd))
		if err != nil {
			msg := strings.TrimSpace(string(out))
			if msg == "" {
				msg = err.Error()
			}
			http.Error(w, "sudo upload failed: "+msg, 500)
			return
		}
	}

	w.WriteHeader(200)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "chunk": chunkStr})
}

// 批量执行命令处理
func handleExec(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == "OPTIONS" {
		w.WriteHeader(200)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "method not allowed", 405)
		return
	}

	var req struct {
		Host     string `json:"host"`
		Port     int    `json:"port"`
		Username string `json:"username"`
		Password string `json:"password"`
		Command  string `json:"command"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "invalid request"})
		return
	}

	if req.Host == "" || req.Username == "" || req.Command == "" {
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "missing parameters"})
		return
	}

	if req.Port == 0 {
		req.Port = 22
	}

	config := &ssh.ClientConfig{
		User:            req.Username,
		Auth:            []ssh.AuthMethod{ssh.Password(req.Password)},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", req.Host, req.Port)
	start := time.Now()

	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "SSH connect failed: " + err.Error(),
			"elapsed": time.Since(start).Milliseconds(),
		})
		return
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "session failed: " + err.Error(),
			"elapsed": time.Since(start).Milliseconds(),
		})
		return
	}
	defer session.Close()

	output, err := session.CombinedOutput(req.Command)
	elapsed := time.Since(start).Milliseconds()

	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"output":  string(output),
			"error":   err.Error(),
			"elapsed": elapsed,
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"output":  string(output),
		"elapsed": elapsed,
	})
}

func splitPath(path string) []string {
	result := []string{}
	for _, p := range strings.Split(path, "/") {
		if p != "" {
			result = append(result, p)
		}
	}
	if len(result) == 0 {
		return []string{"download"}
	}
	return result
}
