# ClawApp 问题排查文档

> 最后更新：2026-02-18

---

## 已修复问题 ✅

### 1. 消息重复显示 + AI 回复刷新才能看到（v1.1.0 修复）

**现象**：发送消息后用户消息重复，AI 流式输出看不到，必须刷新页面

**根因（通过抓包 Gateway 消息确认）**：

1. **agent assistant 事件被错误忽略** — 代码注释掉了 `agent.assistant` 的文本处理，完全依赖 `chat.delta`，但 Gateway 的 `chat.delta` 频率极低（每 5-6 个 token 才发一次），`agent.assistant` 才是逐 token 的流式事件
2. **lifecycle 事件字段名不匹配** — 代码检查 `data.state === 'started'`，但 Gateway 实际发的是 `data.phase === 'start'`，导致 `_isStreaming` 从未被正确设置
3. **空 final 导致状态重置** — Gateway 对一条消息会触发多个 run，第一个 run 经常是空 final（无 message），收到后 `resetStreamState()` 导致后续真正的流式事件被丢弃

**修复**：
- 恢复 `agent.assistant` 事件驱动流式渲染
- 修正 lifecycle 字段：`data.phase === 'start'` / `data.phase === 'end'`
- 忽略空 final（无 bubble 且无 message 时直接 return）

---

## 调试日志

已在前端和服务端添加了调试日志：

### 前端日志（浏览器控制台）
```
[chat] handleEvent: chat {payload...}
[chat] handleChatEvent state: delta sessionKey: xxx _sessionKey: xxx
[chat] appendUserMessage: xxx
[chat] sending to session: xxx
```

### 服务端日志
```
下游消息 [clientId]: {"type":"req","method":"chat.send"...}
上游消息 [clientId] type=event event=chat
```

---

## 排查步骤

### 步骤1：确认消息是否发送到 Gateway

查看服务端日志：
```bash
pm2 logs openclaw-mobile --lines 50 | grep "下游消息"
```

应该看到类似：
```
下游消息 [xxx]: {"type":"req","method":"chat.send"...}
```

如果没有，说明前端没有发送请求。

---

### 步骤2：确认 Gateway 是否返回事件

查看服务端日志：
```bash
pmpm2 logs openclaw-mobile --lines 50 | grep "上游消息"
```

应该看到：
```
上游消息 [xxx] type=event event=chat
```

如果没有，说明 Gateway 没有返回 chat 事件，或者事件被过滤了。

---

### 步骤3：确认前端是否收到事件

在浏览器控制台查看 `[chat]` 日志：
- `[chat] handleEvent:` - 事件到达前端
- `[chat] handleChatEvent state:` - chat 事件处理中

如果没有这些日志，说明 WebSocket 事件没有传到前端。

---

## 关键代码位置

| 文件 | 功能 |
|------|------|
| `h5/src/ws-client.js` | WebSocket 连接、事件分发 |
| `h5/src/chat-ui.js` | 消息渲染、事件处理 |
| `server/index.js` | 代理转发逻辑 |

### 核心函数

- `wsClient.chatSend()` - 发送聊天消息
- `handleChatEvent()` - 处理 chat 事件（delta/final/aborted）
- `appendUserMessage()` / `appendAiMessage()` - 渲染消息
- `handleUpstreamMessage()` - 服务端转发上游事件
- `createConnectFrame(nonce)` - 生成带 Ed25519 签名的握手帧

---

## Device 认证（OpenClaw 2.13+）

代理服务器使用 Ed25519 密钥对进行 device 认证，密钥文件：`server/.device-key.json`（首次启动自动生成）。

### missing scope: operator.write

**原因**：连接 Gateway 时未提供 `device` 参数，scope 被清空

**解决**：确保 `server/index.js` 中 `createConnectFrame` 正确传入 nonce 和 device 签名（v1.1.1+ 已内置）

### NOT_PAIRED / pairing required

**原因**：新 Gateway 首次连接需要配对批准

**解决**：在 Gateway 服务端执行：
```bash
# 查看待配对列表
openclaw gateway call device.pair.list --json

# 批准配对
openclaw gateway call device.pair.approve --params '{"requestId":"<id>"}' --json
```

---

## 测试地址

- 本地：`http://localhost:3210`
- 外网：通过 SSH 隧道或反向代理暴露，示例：
  ```bash
  ssh -f -N -R 0.0.0.0:3210:127.0.0.1:3210 <your-server>
  ```

---

## 相关配置

- Gateway 地址：`ws://127.0.0.1:18789`（通过 `server/.env` 的 `OPENCLAW_GATEWAY_URL` 配置）
