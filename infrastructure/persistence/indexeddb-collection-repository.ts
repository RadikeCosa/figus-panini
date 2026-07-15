import {
  type CollectionState,
  createEmptyCollection,
  normalizeCollection,
} from "../../domain/collection/collection";
import type { CollectionRepository } from "./collection-repository";

export const COLLECTION_DB_NAME = "figus-pani";
export const COLLECTION_DB_SCHEMA_VERSION = 1;
export const COLLECTION_FORMAT_VERSION = 1;

const STORE_NAME = "collections";
const ACTIVE_COLLECTION_KEY = "active";

type PersistedCollectionV1 = {
  formatVersion: 1;
  copiesByPosition: Record<string, number>;
};

type IndexedDbFactoryProvider = {
  indexedDB?: IDBFactory;
};

export class CollectionPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CollectionPersistenceError";
  }
}

export function createIndexedDbCollectionRepository(
  provider: IndexedDbFactoryProvider = globalThis,
): CollectionRepository {
  return new IndexedDbCollectionRepository(provider);
}

export class IndexedDbCollectionRepository implements CollectionRepository {
  constructor(private readonly provider: IndexedDbFactoryProvider = globalThis) {}

  async load(): Promise<CollectionState> {
    const db = await this.openDatabase();

    try {
      const persisted = await readFromStore<unknown>(db, STORE_NAME, ACTIVE_COLLECTION_KEY);

      if (persisted === undefined) {
        return createEmptyCollection();
      }

      return parsePersistedCollection(persisted);
    } finally {
      db.close();
    }
  }

  async save(collection: CollectionState): Promise<void> {
    const db = await this.openDatabase();

    try {
      await writeToStore(db, STORE_NAME, ACTIVE_COLLECTION_KEY, serializeCollection(collection));
    } finally {
      db.close();
    }
  }

  async clear(): Promise<void> {
    const db = await this.openDatabase();

    try {
      await deleteFromStore(db, STORE_NAME, ACTIVE_COLLECTION_KEY);
    } finally {
      db.close();
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    const indexedDB = this.provider.indexedDB;

    if (!indexedDB) {
      return Promise.reject(
        new CollectionPersistenceError("IndexedDB no está disponible en este entorno."),
      );
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(
        COLLECTION_DB_NAME,
        COLLECTION_DB_SCHEMA_VERSION,
      );

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(
          new CollectionPersistenceError(
            `No se pudo abrir IndexedDB: ${request.error?.message ?? "error desconocido"}.`,
          ),
        );
      request.onblocked = () =>
        reject(
          new CollectionPersistenceError(
            "No se pudo abrir IndexedDB porque la base está bloqueada.",
          ),
        );
    });
  }
}

export function serializeCollection(
  collection: CollectionState,
): PersistedCollectionV1 {
  return {
    formatVersion: COLLECTION_FORMAT_VERSION,
    copiesByPosition: { ...collection.copiesByPosition },
  };
}

export function parsePersistedCollection(input: unknown): CollectionState {
  if (!isRecord(input)) {
    throw new CollectionPersistenceError("El formato persistido no es válido.");
  }

  if (input.formatVersion !== COLLECTION_FORMAT_VERSION) {
    throw new CollectionPersistenceError(
      `Versión de colección no soportada: ${String(input.formatVersion)}.`,
    );
  }

  if (!isRecord(input.copiesByPosition)) {
    throw new CollectionPersistenceError("El estado persistido no tiene copias válidas.");
  }

  const result = normalizeCollection(input.copiesByPosition);

  if (result.issues.length > 0) {
    throw new CollectionPersistenceError(
      `El estado persistido contiene datos inválidos: ${result.issues
        .map((issue) => issue.type)
        .join(", ")}.`,
    );
  }

  return result.collection;
}

async function readFromStore<T>(
  db: IDBDatabase,
  storeName: string,
  key: IDBValidKey,
): Promise<T | undefined> {
  const transaction = db.transaction(storeName, "readonly");
  const store = transaction.objectStore(storeName);
  const request = store.get(key);

  return waitForRequest<T | undefined>(request, transaction, "leer la colección");
}

async function writeToStore(
  db: IDBDatabase,
  storeName: string,
  key: IDBValidKey,
  value: unknown,
): Promise<void> {
  const transaction = db.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);
  const request = store.put(value, key);

  await waitForRequest(request, transaction, "guardar la colección");
}

async function deleteFromStore(
  db: IDBDatabase,
  storeName: string,
  key: IDBValidKey,
): Promise<void> {
  const transaction = db.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);
  const request = store.delete(key);

  await waitForRequest(request, transaction, "limpiar la colección");
}

function waitForRequest<T>(
  request: IDBRequest<T>,
  transaction: IDBTransaction,
  action: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new CollectionPersistenceError(
          `No se pudo ${action}: ${request.error?.message ?? "error desconocido"}.`,
        ),
      );
    transaction.onabort = () =>
      reject(
        new CollectionPersistenceError(
          `No se pudo ${action}: la transacción fue abortada.`,
        ),
      );
    transaction.onerror = () =>
      reject(
        new CollectionPersistenceError(
          `No se pudo ${action}: ${
            transaction.error?.message ?? "error de transacción"
          }.`,
        ),
      );
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
