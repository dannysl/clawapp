/**
 * Web Push Notifications 客户端模块
 * 支持：
 * - 请求通知权限
 * - 订阅到 Push Manager
 * - 接收并显示通知
 * - 离线消息缓存
 */

// 检查浏览器支持
export const isSupported = ('Notification' in window) && ('serviceWorker' in navigator) && ('PushManager' in window)

/**
 * 请求通知权限
 * @returns {Promise<NotificationPermission>}
 */
export async function requestPermission() {
  if (!isSupported) {
    console.warn('[Notify] Browser not supported')
    return 'denied'
  }
  
  if (Notification.permission === 'granted') {
    return 'granted'
  }
  
  if (Notification.permission === 'denied') {
    return 'denied'
  }
  
  return await Notification.requestPermission()
}

/**
 * 获取当前权限状态
 */
export function getPermission() {
  if (!isSupported) return 'denied'
  return Notification.permission
}

/**
 * 订阅 Push Manager（生成订阅对象）
 * 注意：需要配合 Service Worker 和后端 VAPID 公钥使用
 * @param {string} vapidPublicKey - VAPID 公钥（Base64 URL 编码）
 * @returns {Promise<PushSubscription|null>}
 */
export async function subscribe(vapidPublicKey) {
  if (!isSupported) {
    console.warn('[Notify] Browser not supported')
    return null
  }
  
  const registration = await navigator.serviceWorker.ready
  
  // 转换为 Uint8Array
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)
  
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey
  })
  
  return subscription
}

/**
 * 取消订阅
 */
export async function unsubscribe() {
  if (!isSupported) return false
  
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  
  if (subscription) {
    await subscription.unsubscribe()
    return true
  }
  return false
}

/**
 * 获取当前订阅
 */
export async function getSubscription() {
  if (!isSupported) return null
  
  const registration = await navigator.serviceWorker.ready
  return await registration.pushManager.getSubscription()
}

/**
 * 显示本地通知（不依赖 Push API）
 * @param {string} title - 通知标题
 * @param {Object} options - 通知选项
 */
export function showNotification(title, options = {}) {
  if (!isSupported || Notification.permission !== 'granted') {
    console.warn('[Notify] Not permitted')
    return
  }
  
  const defaultOptions = {
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'default',
    renotify: true,
    ...options
  }
  
  navigator.serviceWorker.ready.then(registration => {
    registration.showNotification(title, defaultOptions)
  })
}

/**
 * 监听通知点击事件
 * @param {Function} callback - 回调函数
 */
export function onNotificationClick(callback) {
  if (!isSupported) return
  
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'notificationclick') {
      callback(event.data.notification)
    }
  })
}

// ============ 工具函数 ============

/**
 * Base64 URL 编码转 Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  
  return outputArray
}

/**
 * Uint8Array 转 Base64 URL 编码
 */
export function uint8ArrayToUrlBase64(uint8Array) {
  let binary = ''
  const len = uint8Array.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i])
  }
  return window.btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// ============ 离线消息缓存 ============

const OFFLINE_MESSAGES_KEY = 'offline_messages'

/**
 * 缓存离线消息
 */
export function cacheOfflineMessage(message) {
  const messages = JSON.parse(localStorage.getItem(OFFLINE_MESSAGES_KEY) || '[]')
  messages.push({
    ...message,
    timestamp: Date.now()
  })
  // 只保留最近 50 条
  if (messages.length > 50) {
    messages.shift()
  }
  localStorage.setItem(OFFLINE_MESSAGES_KEY, JSON.stringify(messages))
}

/**
 * 获取离线消息
 */
export function getOfflineMessages() {
  return JSON.parse(localStorage.getItem(OFFLINE_MESSAGES_KEY) || '[]')
}

/**
 * 清除离线消息
 */
export function clearOfflineMessages() {
  localStorage.removeItem(OFFLINE_MESSAGES_KEY)
}

/**
 * 显示新消息通知
 * @param {Object} message - 消息对象
 */
export function notifyNewMessage(message) {
  const sender = message.sender || '助手'
  const text = message.text || '[图片/语音]'
  
  // 截断过长内容
  const displayText = text.length > 50 ? text.substring(0, 50) + '...' : text
  
  showNotification(sender, {
    body: displayText,
    tag: 'new-message',
    data: message
  })
}
