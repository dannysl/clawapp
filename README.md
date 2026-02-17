# OpenClaw Mobile

用手机浏览器和你的 OpenClaw AI 智能体聊天。

![架构](https://img.shields.io/badge/架构-H5_+_WebSocket_代理-blue) ![Node](https://img.shields.io/badge/Node.js-≥18-green) ![Docker](https://img.shields.io/badge/Docker-支持-blue) ![License](https://img.shields.io/badge/License-MIT-yellow)

## 这是什么？

OpenClaw 是一个强大的 AI 智能体平台，但它的 Gateway 默认只监听本机（`127.0.0.1:18789`），手机没法直接连。

这个项目解决了这个问题：

```
你的手机浏览器
    ↓ WebSocket
代理服务端（本项目）
    ↓ WebSocket
OpenClaw Gateway（你电脑上的 AI）
```

代理服务端做了三件事：
1. 把 Gateway 的连接从本机扩展到局域网/公网
2. 自动完成 Gateway 的握手认证（你不需要关心协议细节）
3. 同时提供 H5 聊天页面（打开就能用，不需要装 App）

## 功能

- ✅ 实时聊天（流式打字机效果）
- ✅ 图片发送
- ✅ Markdown 渲染（代码高亮、列表、链接）
- ✅ 快捷指令面板（/model、/think、/new 等）
- ✅ 工具调用实时显示
- ✅ 深色主题，移动端优化
- ✅ 自动重连
- ✅ Token 认证

---

## 快速开始

### 前提条件

- 你的电脑上已经在运行 OpenClaw Gateway（默认端口 18789）
- 安装了 [Node.js](https://nodejs.org/) 18+ 或 [Docker](https://www.docker.com/)

### 方式一：Docker 部署（推荐，最简单）

**第 1 步：克隆项目**

```bash
git clone https://github.com/qingchencloud/openclaw-mobile.git
cd openclaw-mobile
```

**第 2 步：配置**

项目根目录创建 `.env` 文件：

```bash
# 手机连接时需要输入的密码（自己随便设一个）
PROXY_TOKEN=my-secret-token-123

# 你的 OpenClaw Gateway Token（在 OpenClaw 配置里找）
OPENCLAW_GATEWAY_TOKEN=你的gateway-token

# 额外允许的域名（如果用反向代理/隧道，填你的域名，否则留空）
ALLOWED_ORIGINS=
```

> 💡 不知道 Gateway Token 在哪？打开 `~/.openclaw/gateway.yaml`，找 `token` 字段。

**第 3 步：启动**

```bash
docker compose up -d --build
```

等待构建完成（首次大约 1-2 分钟），看到类似输出就成功了：

```
✔ Container openclaw-mobile  Started
```

**第 4 步：手机访问**

1. 确保手机和电脑在同一个 WiFi 下
2. 在电脑上查看 IP 地址：
   - Mac: `ifconfig | grep "inet " | grep -v 127.0.0.1`
   - Windows: `ipconfig`
   - Linux: `ip addr`
3. 手机浏览器打开 `http://你的电脑IP:3210`
4. 在连接页面填入：
   - 服务器地址：`你的电脑IP:3210`（页面会自动填好）
   - Token：你在 `.env` 里设的 `PROXY_TOKEN`
5. 点击「连接」，开始聊天！

### 方式二：直接运行（不用 Docker）

```bash
git clone https://github.com/qingchencloud/openclaw-mobile.git
cd openclaw-mobile

# 安装所有依赖
npm run install:all

# 构建 H5 前端
npm run build:h5

# 配置
cp server/.env.example server/.env
# 编辑 server/.env，填入你的 token

# 启动
npm start
```

---

## 从外网访问（不在同一个 WiFi）

局域网部署只能在家里/办公室用。如果你想在外面也能用手机聊天，有两种方案：

### 方案 A：Cloudflare Tunnel（免费，推荐）

不需要公网 IP，不需要改路由器，一行命令搞定。

**安装 cloudflared：**

```bash
# Mac
brew install cloudflared

# Linux
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Windows
# 去 https://github.com/cloudflare/cloudflared/releases 下载
```

**一键穿透：**

```bash
cloudflared tunnel --url http://localhost:3210
```

终端会输出一个公网地址，类似：

```
https://random-words-here.trycloudflare.com
```

手机浏览器打开这个地址就行了。

> ⚠️ 注意：这个地址每次重启 cloudflared 都会变。如果想要固定域名，需要注册 Cloudflare 账号并绑定自己的域名，详见 [Cloudflare Tunnel 文档](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)。

### 方案 B：通过远程服务器做 SSH 端口转发

如果你有一台公网服务器（比如云服务器），可以用 SSH 隧道把本地的 3210 端口映射出去：

```bash
# 在你的电脑上执行（把 your-server.com 换成你的服务器地址）
ssh -R 3210:localhost:3210 user@your-server.com
```

然后手机访问 `http://your-server.com:3210`。

> 服务器上需要在 sshd_config 中设置 `GatewayPorts yes` 才能让外部访问转发的端口。

---

## 在 H5 页面里填什么？

打开 H5 页面后会看到一个连接设置页，需要填两个东西：

| 字段 | 填什么 | 示例 |
|------|--------|------|
| 服务器地址 | 代理服务端的地址和端口 | `192.168.1.100:3210`（局域网）或 `xxx.trycloudflare.com`（隧道） |
| Token | `.env` 里设置的 `PROXY_TOKEN` | `my-secret-token-123` |

> 💡 如果通过 HTTPS 访问（比如 Cloudflare Tunnel），WebSocket 会自动切换为 WSS 加密连接，不需要额外配置。

---

## 环境变量说明

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `PROXY_PORT` | 否 | `3210` | 代理服务端监听端口 |
| `PROXY_TOKEN` | 是 | - | H5 客户端连接密码 |
| `OPENCLAW_GATEWAY_URL` | 否 | `ws://127.0.0.1:18789` | Gateway 地址（Docker 部署会自动设为 `host.docker.internal`） |
| `OPENCLAW_GATEWAY_TOKEN` | 是 | - | Gateway 认证 token |
| `ALLOWED_ORIGINS` | 否 | - | 额外 CORS 白名单，逗号分隔 |

---

## 项目结构

```
openclaw-mobile/
├── server/                # WebSocket 代理服务端
│   ├── index.js           # 主入口（Express + WS 代理）
│   ├── package.json
│   ├── Dockerfile         # 服务端独立 Dockerfile
│   └── .env.example       # 环境变量模板
├── h5/                    # H5 移动端前端
│   ├── src/
│   │   ├── main.js        # 入口 + 连接设置页
│   │   ├── ws-client.js   # WebSocket 协议层
│   │   ├── chat-ui.js     # 聊天 UI
│   │   ├── commands.js    # 快捷指令面板
│   │   ├── markdown.js    # Markdown 渲染 + 代码高亮
│   │   ├── media.js       # 图片处理
│   │   ├── style.css      # 主样式
│   │   └── components.css # 组件样式
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── docs/                  # 文档
│   └── cloudflare-tunnel-guide.md
├── Dockerfile             # 多阶段构建（H5 构建 + 服务端）
├── docker-compose.yml     # 生产部署
├── docker-compose.test.yml # 测试环境（隔离 Gateway）
└── README.md
```

---

## 常见问题

**Q: 连接后一直显示「连接中」？**

检查：
1. OpenClaw Gateway 是否在运行（`curl http://localhost:18789` 看看有没有响应）
2. `OPENCLAW_GATEWAY_TOKEN` 是否正确
3. Docker 部署时，Gateway 地址应该用 `ws://host.docker.internal:18789`

**Q: 手机打不开页面？**

检查：
1. 手机和电脑是否在同一个 WiFi
2. 电脑防火墙是否放行了 3210 端口
3. 地址是否正确（用电脑 IP，不是 localhost）

**Q: WebSocket 经常断开？**

如果通过反向代理或隧道访问，可能是空闲超时。服务端已内置 30 秒心跳保活，一般不会有问题。如果还是断，检查反向代理的超时配置。

**Q: 能同时多人使用吗？**

可以。每个 H5 客户端连接会创建独立的 Gateway 会话。但注意，所有人共享同一个 OpenClaw 实例。

---

## 开发

```bash
# 启动 H5 开发服务器（热更新）
npm run dev:h5

# 启动代理服务端
npm run dev:server
```

H5 开发模式下，Vite 在 5173 端口提供热更新，WebSocket 连接到 3210 端口的代理服务端。

---

## License

MIT
