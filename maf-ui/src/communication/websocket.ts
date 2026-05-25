/**
 * WebSocket 实时协作通信基础
 * 提供 Mock 模式（Tauri 环境下 WebSocket 不可用）和真实 WebSocket 两种实现
 */

// ── 消息格式 ───────────────────────────────────────────────────

export interface WSMessage {
  type: 'cursor' | 'selection' | 'action' | 'presence' | 'sync';
  userId: string;
  payload: unknown;
  timestamp: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

// ── Mock WebSocket ─────────────────────────────────────────────

interface MockUser {
  userId: string;
  nickname: string;
  color: string;
  cursor?: { x: number; y: number };
  selection?: string | null;
}

/** 用于开发/演示的模拟 WebSocket 服务器 */
class MockWebSocketServer {
  private users: Map<string, MockUser> = new Map();
  private listeners: Map<string, Set<(msg: WSMessage) => void>> = new Map();
  private interval: ReturnType<typeof setInterval> | null = null;

  /** 注册一个客户端监听器 */
  addClient(clientId: string, listener: (msg: WSMessage) => void) {
    if (!this.listeners.has(clientId)) {
      this.listeners.set(clientId, new Set());
    }
    this.listeners.get(clientId)!.add(listener);
  }

  /** 当前客户端数量 */
  get clientCount(): number {
    return this.listeners.size;
  }

  /** 移除客户端 */
  removeClient(clientId: string) {
    this.listeners.delete(clientId);
    // 广播用户离开
    if (this.users.has(clientId)) {
      this.users.delete(clientId);
      this.broadcast({
        type: 'presence',
        userId: clientId,
        payload: { action: 'leave', userId: clientId },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /** 注册用户 */
  addUser(user: MockUser) {
    this.users.set(user.userId, user);
    // 广播用户加入
    this.broadcast({
      type: 'presence',
      userId: user.userId,
      payload: {
        action: 'join',
        user: { userId: user.userId, nickname: user.nickname, color: user.color },
      },
      timestamp: new Date().toISOString(),
    });
    // 发送当前在线用户列表给新加入的用户
    const allUsers = Array.from(this.users.values()).map((u) => ({
      userId: u.userId,
      nickname: u.nickname,
      color: u.color,
    }));
    const syncMsg: WSMessage = {
      type: 'sync',
      userId: 'server',
      payload: { users: allUsers },
      timestamp: new Date().toISOString(),
    };
    this.deliver(user.userId, syncMsg);
  }

  /** 广播消息给所有客户端（排除发送者） */
  broadcast(msg: WSMessage, excludeUserId?: string) {
    this.listeners.forEach((handlers, clientId) => {
      if (clientId === excludeUserId) return;
      handlers.forEach((handler) => handler(msg));
    });
  }

  /** 向特定用户发送消息 */
  deliver(userId: string, msg: WSMessage) {
    const handlers = this.listeners.get(userId);
    if (handlers) {
      handlers.forEach((handler) => handler(msg));
    }
  }

  /** 处理客户端消息 */
  handleMessage(msg: WSMessage) {
    // 更新用户状态
    if (msg.type === 'cursor') {
      const user = this.users.get(msg.userId);
      if (user) user.cursor = msg.payload as { x: number; y: number };
    } else if (msg.type === 'selection') {
      const user = this.users.get(msg.userId);
      if (user) user.selection = msg.payload as string | null;
    }
    // 广播给其他客户端
    this.broadcast(msg, msg.userId);
  }

  /** 模拟其他用户的活动（仅用于演示） */
  startSimulation(currentUserId: string) {
    if (this.interval) return;

    // 添加几个模拟用户
    const simulatedUsers: MockUser[] = [
      { userId: 'sim-alice', nickname: 'Alice', color: '#e06c75' },
      { userId: 'sim-bob', nickname: 'Bob', color: '#61afef' },
      { userId: 'sim-carol', nickname: 'Carol', color: '#98c379' },
    ];

    simulatedUsers.forEach((u) => {
      if (!this.users.has(u.userId)) {
        this.users.set(u.userId, u);
        this.broadcast({
          type: 'presence',
          userId: u.userId,
          payload: { action: 'join', user: u },
          timestamp: new Date().toISOString(),
        });
      }
    });

    // 模拟光标移动
    this.interval = setInterval(() => {
      const simUser = simulatedUsers[Math.floor(Math.random() * simulatedUsers.length)];
      const cursorMsg: WSMessage = {
        type: 'cursor',
        userId: simUser.userId,
        payload: {
          x: 200 + Math.random() * 800,
          y: 100 + Math.random() * 400,
        },
        timestamp: new Date().toISOString(),
      };
      this.broadcast(cursorMsg, currentUserId);
    }, 2000);
  }

  stopSimulation() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

// 全局单例 Mock 服务器
const mockServer = new MockWebSocketServer();

// ── CollaborationManager ───────────────────────────────────────

export class CollaborationManager {
  private ws: WebSocket | null = null;
  private mockMode = true;
  private listeners: Map<string, Set<(msg: WSMessage) => void>> = new Map();
  private _status: ConnectionStatus = 'disconnected';
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 3000;
  private url: string | null = null;
  private userId: string | null = null;
  private userInfo: { nickname: string; color: string } | null = null;

  /** 当前连接状态 */
  get status(): ConnectionStatus {
    return this._status;
  }

  /** 设置连接状态并通知监听器 */
  private setStatus(status: ConnectionStatus) {
    this._status = status;
    this.statusListeners.forEach((fn) => fn(status));
  }

  /** 监听连接状态变化 */
  onStatusChange(handler: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(handler);
    return () => this.statusListeners.delete(handler);
  }

  /** 连接到 WebSocket 服务器（或启动 Mock 模式） */
  connect(url?: string, userId?: string, userInfo?: { nickname: string; color: string }) {
    this.userId = userId ?? 'local-user';
    this.userInfo = userInfo ?? { nickname: 'You', color: '#c678dd' };

    if (!url) {
      // Mock 模式
      this.mockMode = true;
      this.setStatus('connecting');

      setTimeout(() => {
        mockServer.addClient(this.userId!, (msg) => this.dispatch(msg));
        mockServer.addUser({
          userId: this.userId!,
          nickname: this.userInfo!.nickname,
          color: this.userInfo!.color,
        });
        mockServer.startSimulation(this.userId!);
        this.setStatus('connected');
        console.log('[WS] Mock mode connected as', this.userId);
      }, 500);
      return;
    }

    // 真实 WebSocket 连接
    this.mockMode = false;
    this.url = url;
    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.setStatus('connected');
        console.log('[WS] Connected to', url);

        // 发送加入消息
        this.send({
          type: 'presence',
          userId: this.userId!,
          payload: { action: 'join', user: { userId: this.userId, ...this.userInfo } },
          timestamp: new Date().toISOString(),
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          this.dispatch(msg);
        } catch (err) {
          console.warn('[WS] Failed to parse message:', err);
        }
      };

      this.ws.onclose = () => {
        this.setStatus('disconnected');
        console.log('[WS] Disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.error('[WS] Error:', err);
        this.setStatus('disconnected');
      };
    } catch (err) {
      console.error('[WS] Connection failed:', err);
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  /** 断开连接 */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.mockMode) {
      mockServer.removeClient(this.userId ?? '');
      if (mockServer.clientCount === 0) {
        mockServer.stopSimulation();
      }
    }

    if (this.ws) {
      this.ws.onclose = null; // 避免触发重连
      this.ws.close();
      this.ws = null;
    }

    this.setStatus('disconnected');
  }

  /** 发送消息 */
  send(message: WSMessage) {
    if (this.mockMode) {
      mockServer.handleMessage(message);
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[WS] Cannot send, connection not open');
    }
  }

  /** 订阅特定类型的消息 */
  on(type: string, handler: (msg: WSMessage) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
    return () => this.listeners.get(type)?.delete(handler);
  }

  /** 预设方法: 广播光标位置 */
  broadcastCursor(position: { x: number; y: number }) {
    this.send({
      type: 'cursor',
      userId: this.userId!,
      payload: position,
      timestamp: new Date().toISOString(),
    });
  }

  /** 预设方法: 广播选中节点 */
  broadcastSelection(nodeId: string | null) {
    this.send({
      type: 'selection',
      userId: this.userId!,
      payload: nodeId,
      timestamp: new Date().toISOString(),
    });
  }

  /** 预设方法: 广播操作 */
  broadcastAction(action: string, data: unknown) {
    this.send({
      type: 'action',
      userId: this.userId!,
      payload: { action, data },
      timestamp: new Date().toISOString(),
    });
  }

  /** 分发消息到对应的监听器 */
  private dispatch(msg: WSMessage) {
    // 类型特定监听器
    const typeListeners = this.listeners.get(msg.type);
    if (typeListeners) {
      typeListeners.forEach((fn) => fn(msg));
    }
    // 通配符监听器
    const allListeners = this.listeners.get('*');
    if (allListeners) {
      allListeners.forEach((fn) => fn(msg));
    }
  }

  /** 断线自动重连 */
  private scheduleReconnect() {
    if (this.reconnectTimer || !this.url) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log('[WS] Attempting reconnect...');
      this.connect(this.url!, this.userId!, this.userInfo!);
    }, this.reconnectDelay);
  }
}

// 全局单例
let _instance: CollaborationManager | null = null;

export function getCollaborationManager(): CollaborationManager {
  if (!_instance) {
    _instance = new CollaborationManager();
  }
  return _instance;
}
