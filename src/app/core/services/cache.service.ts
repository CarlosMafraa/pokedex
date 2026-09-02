import { Injectable } from '@angular/core';

interface CacheData<T> {
  key: string;
  data: T;
  timestamp: number;
  lastAccessed: number;
}

const DB_NAME = 'pokedex_cache_db';
const STORE_NAME = 'cache_store';
const DB_VERSION = 1;
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 horas
const MAX_CACHE_ITEMS = 300;

/**
 * Cache persistente sobre IndexedDB com expiração por item e política LRU.
 * A abertura do banco é memoizada para evitar corrida entre chamadas
 * concorrentes, e cada transação de escrita é aguardada até `oncomplete`.
 */
@Injectable({
  providedIn: 'root',
})
export class CacheService {
  private dbPromise?: Promise<IDBDatabase>;

  private openDB(): Promise<IDBDatabase> {
    this.dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        this.dbPromise = undefined;
        console.error('Erro ao abrir IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        }
      };
    });
    return this.dbPromise;
  }

  private async tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.openDB();
    return db.transaction([STORE_NAME], mode).objectStore(STORE_NAME);
  }

  private static request<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private static done(store: IDBObjectStore): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      store.transaction.oncomplete = () => resolve();
      store.transaction.onerror = () => reject(store.transaction.error);
      store.transaction.onabort = () => reject(store.transaction.error);
    });
  }

  public async set<T>(key: string, data: T): Promise<void> {
    try {
      const store = await this.tx('readwrite');
      const now = Date.now();
      store.put({ key, data, timestamp: now, lastAccessed: now } satisfies CacheData<T>);
      await CacheService.done(store);
      await this.cleanupIfNeeded();
    } catch (error) {
      console.error('Erro ao salvar no cache:', error);
    }
  }

  /** Lê um item e renova seu `lastAccessed`. Retorna `null` se ausente/expirado. */
  public async get<T>(key: string): Promise<T | null> {
    try {
      const entry = await this.peek<T>(key);
      if (!entry) {
        return null;
      }
      await this.touch(key);
      return entry;
    } catch (error) {
      console.error('Erro ao recuperar do cache:', error);
      return null;
    }
  }

  /** Lê um item sem efeitos colaterais (não atualiza `lastAccessed`). */
  public async peek<T>(key: string): Promise<T | null> {
    try {
      const store = await this.tx('readonly');
      const cacheData = await CacheService.request<CacheData<T> | undefined>(store.get(key));
      if (!cacheData) {
        return null;
      }
      if (Date.now() - cacheData.timestamp > CACHE_EXPIRY) {
        await this.remove(key);
        return null;
      }
      return cacheData.data;
    } catch (error) {
      console.error('Erro ao ler o cache:', error);
      return null;
    }
  }

  private async touch(key: string): Promise<void> {
    try {
      const store = await this.tx('readwrite');
      const cacheData = await CacheService.request<CacheData<unknown> | undefined>(store.get(key));
      if (cacheData) {
        cacheData.lastAccessed = Date.now();
        store.put(cacheData);
        await CacheService.done(store);
      }
    } catch (error) {
      console.error('Erro ao atualizar último acesso:', error);
    }
  }

  private async cleanupIfNeeded(): Promise<void> {
    try {
      const store = await this.tx('readwrite');
      const count = await CacheService.request(store.count());
      if (count <= MAX_CACHE_ITEMS) {
        return;
      }

      let toRemove = count - MAX_CACHE_ITEMS;
      await new Promise<void>((resolve, reject) => {
        const cursorReq = store.index('lastAccessed').openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor && toRemove > 0) {
            cursor.delete();
            toRemove--;
            cursor.continue();
          } else {
            resolve();
          }
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });
      await CacheService.done(store);
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
    }
  }

  public async remove(key: string): Promise<void> {
    try {
      const store = await this.tx('readwrite');
      store.delete(key);
      await CacheService.done(store);
    } catch (error) {
      console.error('Erro ao remover do cache:', error);
    }
  }

  public async clearAll(): Promise<void> {
    try {
      const store = await this.tx('readwrite');
      store.clear();
      await CacheService.done(store);
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
    }
  }

  public async has(key: string): Promise<boolean> {
    return (await this.peek(key)) !== null;
  }
}
