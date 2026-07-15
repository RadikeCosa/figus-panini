import { beforeEach, describe, expect, it } from "vitest";
import { indexedDB } from "fake-indexeddb";
import {
  createEmptyCollection,
  getCopies,
  makePositionKey,
  setCopies,
} from "../../domain/collection/collection";
import {
  COLLECTION_DB_NAME,
  COLLECTION_DB_SCHEMA_VERSION,
  COLLECTION_FORMAT_VERSION,
  CollectionPersistenceError,
  createIndexedDbCollectionRepository,
  serializeCollection,
} from "./indexeddb-collection-repository";

const panini = { section: "PANINI", position: "00" };
const mexico1 = { section: "México", position: "1" };
const mexico2 = { section: "México", position: "2" };
const unknown = { section: "Coca-Cola", position: "1" };

describe("IndexedDB collection repository", () => {
  beforeEach(async () => {
    await deleteDatabase();
  });

  it("loads an empty collection when no data exists yet", async () => {
    const repository = createIndexedDbCollectionRepository({ indexedDB });

    await expect(repository.load()).resolves.toEqual(createEmptyCollection());
  });

  it("saves and loads a collection", async () => {
    const repository = createIndexedDbCollectionRepository({ indexedDB });
    const collection = setCopies(createEmptyCollection(), mexico1, 1);

    await repository.save(collection);

    const loaded = await repository.load();
    expect(getCopies(loaded, mexico1)).toBe(1);
  });

  it("persists several copies", async () => {
    const repository = createIndexedDbCollectionRepository({ indexedDB });
    const collection = setCopies(createEmptyCollection(), mexico1, 4);

    await repository.save(collection);

    expect(getCopies(await repository.load(), mexico1)).toBe(4);
  });

  it("does not store zero entries", async () => {
    const repository = createIndexedDbCollectionRepository({ indexedDB });
    const collection = setCopies(
      setCopies(createEmptyCollection(), mexico1, 2),
      mexico1,
      0,
    );

    await repository.save(collection);

    const persisted = await readPersistedValue();
    expect(persisted).toEqual({
      formatVersion: COLLECTION_FORMAT_VERSION,
      copiesByPosition: {},
    });
  });

  it("replaces a previous collection completely", async () => {
    const repository = createIndexedDbCollectionRepository({ indexedDB });

    await repository.save(setCopies(createEmptyCollection(), mexico1, 2));
    await repository.save(setCopies(createEmptyCollection(), mexico2, 3));

    const loaded = await repository.load();
    expect(getCopies(loaded, mexico1)).toBe(0);
    expect(getCopies(loaded, mexico2)).toBe(3);
  });

  it("isolates persisted data from the original collection object", async () => {
    const repository = createIndexedDbCollectionRepository({ indexedDB });
    const collection = setCopies(createEmptyCollection(), mexico1, 2);

    await repository.save(collection);
    collection.copiesByPosition[makePositionKey(mexico1)] = 10;

    expect(getCopies(await repository.load(), mexico1)).toBe(2);
  });

  it("stores the expected persisted format version", async () => {
    const repository = createIndexedDbCollectionRepository({ indexedDB });
    const collection = setCopies(createEmptyCollection(), panini, 1);

    await repository.save(collection);

    expect(await readPersistedValue()).toEqual(serializeCollection(collection));
  });

  it("rejects unsupported persisted format versions", async () => {
    const repository = createIndexedDbCollectionRepository({ indexedDB });
    await writePersistedValue({
      formatVersion: 999,
      copiesByPosition: {},
    });

    await expect(repository.load()).rejects.toThrow(CollectionPersistenceError);
    await expect(repository.load()).rejects.toThrow("Versión de colección");
  });

  it("rejects corrupt persisted structures", async () => {
    const repository = createIndexedDbCollectionRepository({ indexedDB });
    await writePersistedValue({
      formatVersion: COLLECTION_FORMAT_VERSION,
      copiesByPosition: "nope",
    });

    await expect(repository.load()).rejects.toThrow("copias válidas");
  });

  it("normalizes valid stored data", async () => {
    const repository = createIndexedDbCollectionRepository({ indexedDB });
    await writePersistedValue({
      formatVersion: COLLECTION_FORMAT_VERSION,
      copiesByPosition: {
        [makePositionKey(mexico1)]: 0,
        [makePositionKey(mexico2)]: 2,
      },
    });

    const loaded = await repository.load();
    expect(getCopies(loaded, mexico1)).toBe(0);
    expect(getCopies(loaded, mexico2)).toBe(2);
    expect(loaded.copiesByPosition).toEqual({
      [makePositionKey(mexico2)]: 2,
    });
  });

  it("rejects unknown stored keys", async () => {
    const repository = createIndexedDbCollectionRepository({ indexedDB });
    await writePersistedValue({
      formatVersion: COLLECTION_FORMAT_VERSION,
      copiesByPosition: {
        [makePositionKey(unknown)]: 1,
      },
    });

    await expect(repository.load()).rejects.toThrow("unknown-position");
  });

  it("rejects invalid stored quantities", async () => {
    const repository = createIndexedDbCollectionRepository({ indexedDB });
    await writePersistedValue({
      formatVersion: COLLECTION_FORMAT_VERSION,
      copiesByPosition: {
        [makePositionKey(mexico1)]: 1.5,
      },
    });

    await expect(repository.load()).rejects.toThrow("invalid-quantity");
  });

  it("fails clearly when IndexedDB is not available", async () => {
    const repository = createIndexedDbCollectionRepository({});

    await expect(repository.load()).rejects.toThrow("IndexedDB no está disponible");
  });

  it("opens repeatedly without recreating or losing data", async () => {
    const firstRepository = createIndexedDbCollectionRepository({ indexedDB });
    const secondRepository = createIndexedDbCollectionRepository({ indexedDB });

    await firstRepository.save(setCopies(createEmptyCollection(), mexico1, 2));

    expect(getCopies(await secondRepository.load(), mexico1)).toBe(2);
    expect(getCopies(await firstRepository.load(), mexico1)).toBe(2);
  });

  it("clears the active collection", async () => {
    const repository = createIndexedDbCollectionRepository({ indexedDB });
    await repository.save(setCopies(createEmptyCollection(), mexico1, 2));

    await repository.clear();

    await expect(repository.load()).resolves.toEqual(createEmptyCollection());
  });
});

async function readPersistedValue(): Promise<unknown> {
  const db = await openDatabase();

  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction("collections", "readonly");
      const request = transaction.objectStore("collections").get("active");

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function writePersistedValue(value: unknown): Promise<void> {
  const db = await openDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("collections", "readwrite");
      const request = transaction.objectStore("collections").put(value, "active");

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(
      COLLECTION_DB_NAME,
      COLLECTION_DB_SCHEMA_VERSION,
    );

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("collections")) {
        db.createObjectStore("collections");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(COLLECTION_DB_NAME);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(request.error);
  });
}
