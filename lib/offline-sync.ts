/**
 * Gestor de sincronización offline con IndexedDB para Atelier Beauty Studio.
 *
 * Reglas de negocio obligatorias:
 * - Detectar pérdida y recuperación de conexión.
 * - Guardar temporalmente operaciones permitidas.
 * - Cola de operaciones pendientes con identificador único.
 * - Evitar operaciones duplicadas.
 * - Registrar fecha y hora de sincronización.
 * - Detectar conflictos entre modificaciones locales y remotas.
 * - La nube es la fuente de verdad: no confirmar reservas públicas offline ni sobrescribir turnos remotos.
 */

export interface OfflineOperation {
  id: string
  action: 'create_appointment' | 'update_status' | 'register_payment' | 'record_inventory'
  payload: any
  status: 'pending' | 'synced' | 'conflict' | 'failed'
  createdAt: string
  syncedAt?: string
  error?: string
}

const DB_NAME = 'atelier_beauty_offline_db'
const DB_VERSION = 1
const STORE_OPERATIONS = 'sync_queue'
const STORE_LOCAL_CACHE = 'local_cache'

class OfflineSyncManager {
  private dbPromise: Promise<IDBDatabase> | null = null

  private getDB(): Promise<IDBDatabase> {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('IndexedDB solo está disponible en el navegador.'))
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION)

        req.onupgradeneeded = () => {
          const db = req.result
          if (!db.objectStoreNames.contains(STORE_OPERATIONS)) {
            db.createObjectStore(STORE_OPERATIONS, { keyPath: 'id' })
          }
          if (!db.objectStoreNames.contains(STORE_LOCAL_CACHE)) {
            db.createObjectStore(STORE_LOCAL_CACHE, { keyPath: 'key' })
          }
        }

        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
    }
    return this.dbPromise
  }

  /**
   * Guarda una operación en la cola de sincronización pendiente
   */
  async enqueueOperation(action: OfflineOperation['action'], payload: any): Promise<OfflineOperation> {
    const db = await this.getDB()
    const operation: OfflineOperation = {
      id: `op-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      action,
      payload,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_OPERATIONS, 'readwrite')
      const store = tx.objectStore(STORE_OPERATIONS)
      const req = store.add(operation)
      req.onsuccess = () => resolve(operation)
      req.onerror = () => reject(req.error)
    })
  }

  /**
   * Obtiene todas las operaciones pendientes de sincronizar
   */
  async getPendingOperations(): Promise<OfflineOperation[]> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_OPERATIONS, 'readonly')
      const store = tx.objectStore(STORE_OPERATIONS)
      const req = store.getAll()
      req.onsuccess = () => {
        const ops = (req.result as OfflineOperation[]).filter((op) => op.status === 'pending')
        resolve(ops)
      }
      req.onerror = () => reject(req.error)
    })
  }

  /**
   * Marca una operación como sincronizada con éxito
   */
  async markOperationSynced(id: string): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_OPERATIONS, 'readwrite')
      const store = tx.objectStore(STORE_OPERATIONS)
      const getReq = store.get(id)
      getReq.onsuccess = () => {
        const op = getReq.result as OfflineOperation
        if (op) {
          op.status = 'synced'
          op.syncedAt = new Date().toISOString()
          store.put(op)
        }
        resolve()
      }
      getReq.onerror = () => reject(getReq.error)
    })
  }

  /**
   * Marca una operación con conflicto para que el usuario sea informado
   */
  async markOperationConflict(id: string, reason: string): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_OPERATIONS, 'readwrite')
      const store = tx.objectStore(STORE_OPERATIONS)
      const getReq = store.get(id)
      getReq.onsuccess = () => {
        const op = getReq.result as OfflineOperation
        if (op) {
          op.status = 'conflict'
          op.error = reason
          store.put(op)
        }
        resolve()
      }
      getReq.onerror = () => reject(getReq.error)
    })
  }

  /**
   * Guarda caché local de la última agenda recibida
   */
  async cacheAgenda(appointments: any[]): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LOCAL_CACHE, 'readwrite')
      const store = tx.objectStore(STORE_LOCAL_CACHE)
      store.put({ key: 'last_synced_appointments', data: appointments, timestamp: new Date().toISOString() })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  /**
   * Obtiene la última agenda local en caso de estar offline
   */
  async getCachedAgenda(): Promise<any[] | null> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LOCAL_CACHE, 'readonly')
      const store = tx.objectStore(STORE_LOCAL_CACHE)
      const req = store.get('last_synced_appointments')
      req.onsuccess = () => resolve(req.result ? req.result.data : null)
      req.onerror = () => reject(req.error)
    })
  }
}

export const offlineSync = new OfflineSyncManager()
