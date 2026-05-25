# LinkHub SSH Server

部署在服务器上的 WebSocket-SSH 中转服务，配合 LinkHub 浏览器插件使用。

## 功能

- WebSocket 转 SSH，让浏览器直接连接远程服务器终端
- 支持密码和私钥两种认证方式
- 支持 Token 认证，防止未授权访问
- 支持多连接、终端大小调整
- 心跳保活，自动断开超时连接
- 单文件部署，无依赖

## 编译

需要 Go 1.21+

```bash
# 下载依赖
go mod tidy

# 编译 Linux（部署到服务器）
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o linkhub-ssh .

# 编译 Windows
go build -o linkhub-ssh.exe .
```

## 部署到服务器

```bash
# 上传编译好的文件到服务器
scp linkhub-ssh root@your-server:/usr/local/bin/

# SSH 登录服务器
ssh root@your-server

# 赋予执行权限
chmod +x /usr/local/bin/linkhub-ssh

# 启动（带 Token 认证）
/usr/local/bin/linkhub-ssh -token "your-secret-token"

# 或指定端口
/usr/local/bin/linkhub-ssh -port 18022 -token "your-secret-token"
```

## 命令行参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| -port | 18022 | 监听端口 |
| -bind | 0.0.0.0 | 监听地址 |
| -token | (空) | 认证 Token，为空则不需要认证 |

## 设置为系统服务（推荐）

创建 systemd 服务文件：

```bash
cat > /etc/systemd/system/linkhub-ssh.service << 'EOF'
[Unit]
Description=LinkHub SSH Server
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/linkhub-ssh -port 18022 -token "your-secret-token"
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 启动并设置开机自启
systemctl daemon-reload
systemctl enable linkhub-ssh
systemctl start linkhub-ssh

# 查看状态
systemctl status linkhub-ssh

# 查看日志
journalctl -u linkhub-ssh -f
```

## 防火墙

```bash
# 开放端口
firewall-cmd --permanent --add-port=18022/tcp
firewall-cmd --reload

# 或用 iptables
iptables -A INPUT -p tcp --dport 18022 -j ACCEPT
```

## 通信协议

### 客户端 → 服务端

**认证（如果设置了 Token）：**
```json
{"type": "auth", "token": "your-secret-token"}
```

**连接 SSH（密码方式）：**
```json
{
  "type": "connect",
  "host": "192.168.1.100",
  "port": 22,
  "username": "root",
  "password": "xxx",
  "cols": 120,
  "rows": 40
}
```

**连接 SSH（私钥方式）：**
```json
{
  "type": "connect",
  "host": "192.168.1.100",
  "port": 22,
  "username": "root",
  "key": "-----BEGIN RSA PRIVATE KEY-----\n...",
  "cols": 120,
  "rows": 40
}
```

**发送输入：**
```json
{"type": "input", "data": "ls -la\n"}
```

**调整终端大小：**
```json
{"type": "resize", "cols": 150, "rows": 50}
```

**断开连接：**
```json
{"type": "disconnect"}
```

### 服务端 → 客户端

```json
{"type": "auth_ok"}
{"type": "connected", "data": "192.168.1.100:22"}
{"type": "output", "data": "root@server:~# "}
{"type": "error", "data": "SSH 连接失败: ..."}
{"type": "disconnect", "data": "SSH 连接已断开"}
{"type": "disconnected"}
```

## 安全建议

1. **必须设置 Token** — 防止任何人连接你的中转服务
2. **使用 HTTPS/WSS** — 在前面加 Nginx 反向代理，配置 SSL 证书
3. **限制来源 IP** — 用防火墙只允许你的 IP 访问
4. **定期更换 Token** — 避免泄露

### Nginx 反向代理配置（WSS）

```nginx
server {
    listen 443 ssl;
    server_name ssh.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /ws {
        proxy_pass http://127.0.0.1:18022;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

这样插件连接 `wss://ssh.yourdomain.com/ws` 即可，流量全程加密。
