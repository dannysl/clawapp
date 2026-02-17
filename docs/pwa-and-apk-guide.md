# PWA 配置 & Android APK 自动打包指南

本文档介绍如何将 ClawApp H5 客户端配置为 PWA（渐进式 Web 应用），以及如何通过 GitHub Actions 自动打包 Android APK。

---

## 目录

- [一、PWA 配置（iOS + Android 通用）](#一pwa-配置ios--android-通用)
  - [1.1 什么是 PWA](#11-什么是-pwa)
  - [1.2 需要添加的文件](#12-需要添加的文件)
  - [1.3 修改 index.html](#13-修改-indexhtml)
  - [1.4 生成图标](#14-生成图标)
  - [1.5 用户使用方式](#15-用户使用方式)
- [二、Android APK 自动打包](#二android-apk-自动打包)
  - [2.1 方案选择](#21-方案选择)
  - [2.2 项目结构](#22-项目结构)
  - [2.3 Capacitor 初始化步骤](#23-capacitor-初始化步骤)
  - [2.4 GitHub Actions 工作流](#24-github-actions-工作流)
  - [2.5 签名配置](#25-签名配置)
  - [2.6 用户使用方式](#26-用户使用方式)
- [三、兼容性说明](#三兼容性说明)

---

## 一、PWA 配置（iOS + Android 通用）

### 1.1 什么是 PWA

PWA 让用户可以把网页"安装"到手机主屏幕，效果：
- 有独立的 App 图标
- 打开后全屏显示，没有浏览器地址栏
- 支持离线缓存（可选）
- iOS Safari 和 Android Chrome 都支持

**特别适合我们的场景**：每个用户部署的服务地址不同，用户访问自己的地址后添加到主屏幕，就是一个指向自己服务的"App"。

### 1.2 需要添加的文件

> ✅ 以下文件已全部创建完成，无需手动操作。

#### `h5/public/manifest.json`

```json
{
  "name": "ClawApp - OpenClaw 移动端",
  "short_name": "ClawApp",
  "description": "OpenClaw AI 智能体平台移动端客户端",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#1a1a2e",
  "theme_color": "#1a1a2e",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

#### `h5/public/sw.js`（可选，Service Worker 离线缓存）

```js
const CACHE_NAME = 'clawapp-v1'
const ASSETS = ['/', '/index.html']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
})

self.addEventListener('fetch', e => {
  // 网络优先，失败回退缓存
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  )
})
```

> Service Worker 是可选的。不加也能添加到主屏幕，加了可以在弱网时有更好的体验。

### 1.3 修改 index.html

> ✅ 已通过 vite-plugin-pwa 自动注入，无需手动修改。

在 `<head>` 中添加以下标签：

```html
<!-- PWA manifest -->
<link rel="manifest" href="/manifest.json" />

<!-- iOS PWA 支持（已有的保留，补充缺少的） -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="ClawApp" />
<link rel="apple-touch-icon" href="/icons/icon-180.png" />

<!-- 可选：注册 Service Worker -->
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }
</script>
```

### 1.4 生成图标

> ✅ 图标已生成并放置在 `h5/public/` 目录下（icon-192.png、icon-512.png、apple-touch-icon-180x180.png）。

需要以下尺寸的 PNG 图标：

| 文件名 | 尺寸 | 用途 |
|--------|------|------|
| `icon-180.png` | 180×180 | iOS Apple Touch Icon |
| `icon-192.png` | 192×192 | Android PWA 图标 |
| `icon-512.png` | 512×512 | Android PWA 启动画面 |

可以用现有的 `favicon.svg` 生成：

```bash
# 安装 sharp-cli（或用任何图片处理工具）
npx sharp-cli -i h5/public/favicon.svg -o h5/public/icons/icon-180.png resize 180 180
npx sharp-cli -i h5/public/favicon.svg -o h5/public/icons/icon-192.png resize 192 192
npx sharp-cli -i h5/public/favicon.svg -o h5/public/icons/icon-512.png resize 512 512
```

或者用在线工具：https://realfavicongenerator.net/

### 1.5 用户使用方式

**iOS（Safari）：**
1. 用 Safari 打开自己部署的地址（如 `http://192.168.1.14:3210`）
2. 点底部分享按钮 → "添加到主屏幕"
3. 主屏幕出现 ClawApp 图标，点击打开就是全屏 App 体验

**Android（Chrome）：**
1. 用 Chrome 打开地址
2. 浏览器会自动弹出"添加到主屏幕"提示（或点菜单 → "安装应用"）
3. 安装后在桌面和应用列表都能看到

---

## 二、Android APK 自动打包

### 2.1 方案选择

| 方案 | 原理 | 优点 | 缺点 |
|------|------|------|------|
| **TWA** | Chrome 自定义标签页 | 最轻量，不需要写代码 | 必须有公网 HTTPS 地址 |
| **Capacitor** ✅ | WebView 包装 H5 | 灵活，支持本地加载 | 需要 Android 项目结构 |
| **Cordova** | WebView 包装 H5 | 生态成熟 | 较老，社区活跃度下降 |

**推荐 Capacitor**：H5 资源打包进 APK，用户打开 App 就是连接页面，输入自己的地址和 token。不依赖公网地址，内网也能用。

### 2.2 项目结构

```
openclaw-mobile/
├── h5/                    # 现有 H5 项目
├── android/               # Capacitor 生成的 Android 项目（自动生成）
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   └── res/       # 图标资源
│   │   └── build.gradle
│   └── build.gradle
├── capacitor.config.ts    # Capacitor 配置
└── .github/
    └── workflows/
        └── build-apk.yml  # GitHub Actions 工作流
```

### 2.3 Capacitor 初始化步骤

> ✅ Capacitor 已初始化完成，`android/` 目录已生成。

在项目根目录执行：

```bash
# 1. 安装 Capacitor（已完成）
cd clawapp
npm install @capacitor/core @capacitor/cli --save-dev
npm install @capacitor/android --save-dev

# 2. 初始化 Capacitor（已完成）
npx cap init "ClawApp" "com.qingchencloud.clawapp" --web-dir h5/dist

# 3. 添加 Android 平台（已完成）
npx cap add android

# 4. 构建 H5 并同步到 Android 项目
npm run build:h5
npx cap sync android
```

#### `capacitor.config.ts`

```ts
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.qingchencloud.clawapp',
  appName: 'ClawApp',
  webDir: 'h5/dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
  },
}

export default config
```

### 2.4 GitHub Actions 工作流

> ✅ 工作流文件已创建：`.github/workflows/build-apk.yml`

#### `.github/workflows/build-apk.yml`

```yaml
name: Build Android APK

on:
  push:
    tags:
      - 'v*'  # 打 tag 时触发，如 v1.0.0
  workflow_dispatch:  # 支持手动触发

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Install dependencies
        run: |
          npm ci
          cd h5 && npm ci

      - name: Build H5
        run: npm run build:h5

      - name: Sync Capacitor
        run: npx cap sync android

      - name: Build APK (Debug)
        run: |
          cd android
          chmod +x gradlew
          ./gradlew assembleDebug

      - name: Build APK (Release - 签名版)
        if: ${{ env.KEYSTORE_BASE64 != '' }}
        env:
          KEYSTORE_BASE64: ${{ secrets.KEYSTORE_BASE64 }}
          KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
          KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
          KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
        run: |
          echo "$KEYSTORE_BASE64" | base64 -d > android/app/release.keystore
          cd android
          ./gradlew assembleRelease \
            -Pandroid.injected.signing.store.file=$PWD/app/release.keystore \
            -Pandroid.injected.signing.store.password=$KEYSTORE_PASSWORD \
            -Pandroid.injected.signing.key.alias=$KEY_ALIAS \
            -Pandroid.injected.signing.key.password=$KEY_PASSWORD

      - name: Upload Debug APK
        uses: actions/upload-artifact@v4
        with:
          name: clawapp-debug
          path: android/app/build/outputs/apk/debug/*.apk

      - name: Upload Release APK
        if: ${{ env.KEYSTORE_BASE64 != '' }}
        uses: actions/upload-artifact@v4
        with:
          name: clawapp-release
          path: android/app/build/outputs/apk/release/*.apk

      - name: Create GitHub Release
        if: startsWith(github.ref, 'refs/tags/')
        uses: softprops/action-gh-release@v2
        with:
          files: |
            android/app/build/outputs/apk/debug/*.apk
            android/app/build/outputs/apk/release/*.apk
          generate_release_notes: true
```

### 2.5 签名配置

Debug APK 不需要签名，可以直接安装测试。

Release APK 需要签名，步骤：

```bash
# 1. 生成签名密钥（本地执行一次）
keytool -genkey -v -keystore clawapp-release.keystore \
  -alias clawapp -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass YOUR_PASSWORD -keypass YOUR_PASSWORD \
  -dname "CN=ClawApp, O=OpenClaw, C=CN"

# 2. 转为 base64
base64 -i clawapp-release.keystore | pbcopy  # macOS，复制到剪贴板

# 3. 在 GitHub 仓库 Settings → Secrets and variables → Actions 添加：
#    KEYSTORE_BASE64    = 上面复制的 base64
#    KEYSTORE_PASSWORD  = YOUR_PASSWORD
#    KEY_ALIAS          = clawapp
#    KEY_PASSWORD        = YOUR_PASSWORD
```

不配置签名也没关系，工作流会自动跳过 Release 构建，只产出 Debug APK。

### 2.6 用户使用方式

1. 去 GitHub Releases 页面下载 APK
2. 安装到手机（需要开启"允许安装未知来源应用"）
3. 打开 App → 输入自己部署的服务器地址和 token → 连接
4. 和网页版完全一样的体验，但有独立的 App 图标和全屏界面

---

## 三、兼容性说明

| 功能 | iOS Safari | Android Chrome | 鸿蒙浏览器 |
|------|-----------|---------------|-----------|
| PWA 添加到主屏幕 | ✅ iOS 11.3+ | ✅ Chrome 72+ | ✅ 基于 Chromium |
| 全屏 standalone 模式 | ✅ | ✅ | ✅ |
| Service Worker 缓存 | ✅ iOS 11.3+ | ✅ | ✅ |
| APK 安装 | ❌ | ✅ | ✅ 旧鸿蒙（AOSP） / ❌ 鸿蒙 NEXT |
| WebSocket | ✅ | ✅ | ✅ |

**建议优先级**：
1. 先加 PWA manifest（10 分钟，iOS + Android 都受益）
2. 再配 Capacitor + GitHub Actions（出 APK，给 Android 用户多一个选择）
3. 鸿蒙 NEXT 等有明确需求再考虑

---

> 💡 PWA 和 APK 不冲突。PWA 是给已经部署了服务的用户快速"安装"的方式，APK 是给喜欢原生 App 体验的用户。两者打开后都是同一个连接页面，输入自己的地址就能用。
