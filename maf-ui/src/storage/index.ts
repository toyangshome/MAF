/**
 * 本地数据持久化层 - 存储抽象接口与适配器
 */

// ── 接口 ──────────────────────────────────────────────────────────────

export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

// ── 类型 ──────────────────────────────────────────────────────────────

export interface UserPreferences {
  theme: string;
  sidebarCollapsed: boolean;
  logAutoRefresh: 'off' | '1s' | '5s' | '10s';
  logMaxEntries: number;
  dashboardAutoRefresh: 'off' | '10s' | '30s' | '1min' | '5min';
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  sidebarCollapsed: false,
  logAutoRefresh: 'off',
  logMaxEntries: 1000,
  dashboardAutoRefresh: 'off',
};

// ── localStorage 适配器（小数据 < 5MB）─────────────────────────────────

export class LocalStorageAdapter implements StorageAdapter {
  private prefix: string;

  constructor(prefix = 'maf_') {
    this.prefix = prefix;
  }

  private key(k: string): string {
    return `${this.prefix}${k}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(this.key(key));
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      console.warn(`[Storage] Failed to read key "${key}" from localStorage`);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(this.key(key), JSON.stringify(value));
    } catch (err) {
      console.warn(`[Storage] Failed to write key "${key}" to localStorage:`, err);
    }
  }

  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(this.key(key));
    } catch {
      // ignore
    }
  }

  async clear(): Promise<void> {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this.prefix)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }
  }
}

// ── IndexedDB 适配器（大数据，日志、任务历史）───────────────────────────

const DB_NAME = 'maf-ui';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class IndexedDBAdapter implements StorageAdapter {
  private storeName: string;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(storeName = 'kv') {
    this.storeName = storeName;
  }

  /** Cache and reuse the database connection */
  private getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB().then((db) => {
        db.onclose = () => { this.dbPromise = null; };
        return db;
      }).catch((err) => {
        this.dbPromise = null;
        throw err;
      });
    }
    return this.dbPromise;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const db = await this.getDB();
      return await new Promise<T | null>((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get(key);
        req.onsuccess = () => {
          resolve(req.result !== undefined ? (req.result as T) : null);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      console.warn(`[Storage] Failed to read key "${key}" from IndexedDB`);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn(`[Storage] Failed to write key "${key}" to IndexedDB:`, err);
    }
  }

  async remove(key: string): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // ignore
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // ignore
    }
  }
}

// ── 单例实例 ──────────────────────────────────────────────────────────

export const localStorageAdapter = new LocalStorageAdapter('maf_');
export const indexedDBAdapter = new IndexedDBAdapter('kv');
