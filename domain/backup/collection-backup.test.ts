import { describe, expect, it } from "vitest";
import {
  createEmptyCollection,
  getCopies,
  makePositionKey,
  setCopies,
} from "../collection/collection";
import {
  COLLECTION_BACKUP_FORMAT_VERSION,
  COLLECTION_BACKUP_TYPE,
  buildCollectionBackupFileName,
  createCollectionBackup,
  parseCollectionBackupText,
  serializeCollectionBackup,
  validateCollectionBackup,
} from "./collection-backup";

const exportedAt = new Date("2026-07-15T12:00:00.000Z");
const panini = { section: "PANINI", position: "00" };
const argentina7 = { section: "Argentina", position: "7" };
const mexico1 = { section: "México", position: "1" };
const unknownKey = makePositionKey({ section: "Italia", position: "7" });

describe("collection backup", () => {
  it("creates a valid backup with type, version and date", () => {
    const backup = createCollectionBackup(createEmptyCollection(), exportedAt);

    expect(backup).toEqual({
      type: COLLECTION_BACKUP_TYPE,
      formatVersion: COLLECTION_BACKUP_FORMAT_VERSION,
      exportedAt: "2026-07-15T12:00:00.000Z",
      copiesByPosition: {},
    });
  });

  it("serializes a backup in stable JSON", () => {
    const collection = setCopies(
      setCopies(createEmptyCollection(), mexico1, 2),
      argentina7,
      3,
    );
    const backup = createCollectionBackup(collection, exportedAt);

    expect(serializeCollectionBackup(backup)).toBe(`{
  "type": "figus-pani-backup",
  "formatVersion": 1,
  "exportedAt": "2026-07-15T12:00:00.000Z",
  "copiesByPosition": {
    "Argentina|7": 3,
    "M%C3%A9xico|1": 2
  }
}
`);
  });

  it("parses an empty collection backup", () => {
    const result = parseCollectionBackupText(
      serializeCollectionBackup(createCollectionBackup(createEmptyCollection(), exportedAt)),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.summary).toMatchObject({
        exportedAt: "2026-07-15T12:00:00.000Z",
        uniqueOwned: 0,
        missing: 980,
        duplicateCopies: 0,
        physicalCopies: 0,
        duplicatePositions: 0,
      });
    }
  });

  it("parses a backup with copies and repeated positions", () => {
    const collection = setCopies(
      setCopies(setCopies(createEmptyCollection(), argentina7, 4), mexico1, 1),
      panini,
      2,
    );
    const result = parseCollectionBackupText(
      serializeCollectionBackup(createCollectionBackup(collection, exportedAt)),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(getCopies(result.value.collection, argentina7)).toBe(4);
      expect(result.value.summary).toMatchObject({
        uniqueOwned: 3,
        missing: 977,
        duplicateCopies: 4,
        physicalCopies: 7,
        duplicatePositions: 2,
      });
    }
  });

  it("rejects malformed JSON", () => {
    const result = parseCollectionBackupText("{nope");

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: "malformed-json" }],
    });
  });

  it("rejects a non-object root", () => {
    const result = parseCollectionBackupText("[]");

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: "root-not-object" }],
    });
  });

  it("rejects an incorrect type", () => {
    const result = validateCollectionBackup({
      type: "other",
      formatVersion: 1,
      exportedAt: "2026-07-15T12:00:00.000Z",
      copiesByPosition: {},
    });

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-type" }],
    });
  });

  it("rejects an unsupported version", () => {
    const result = validateCollectionBackup({
      type: COLLECTION_BACKUP_TYPE,
      formatVersion: 2,
      exportedAt: "2026-07-15T12:00:00.000Z",
      copiesByPosition: {},
    });

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: "unsupported-version" }],
    });
  });

  it("rejects an invalid export date", () => {
    const result = validateCollectionBackup({
      type: COLLECTION_BACKUP_TYPE,
      formatVersion: 1,
      exportedAt: "today",
      copiesByPosition: {},
    });

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-exported-at" }],
    });
  });

  it("rejects missing copiesByPosition", () => {
    const result = validateCollectionBackup({
      type: COLLECTION_BACKUP_TYPE,
      formatVersion: 1,
      exportedAt: "2026-07-15T12:00:00.000Z",
    });

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: "missing-copies" }],
    });
  });

  it("rejects invalid quantities and keeps a conservative policy", () => {
    const result = validateCollectionBackup({
      type: COLLECTION_BACKUP_TYPE,
      formatVersion: 1,
      exportedAt: "2026-07-15T12:00:00.000Z",
      copiesByPosition: {
        [makePositionKey(argentina7)]: 1.5,
        [makePositionKey(mexico1)]: -1,
        [makePositionKey(panini)]: "2",
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map(({ code }) => code)).toEqual([
        "invalid-quantity",
        "invalid-quantity",
        "invalid-quantity",
      ]);
    }
  });

  it("rejects unknown position keys", () => {
    const result = validateCollectionBackup({
      type: COLLECTION_BACKUP_TYPE,
      formatVersion: 1,
      exportedAt: "2026-07-15T12:00:00.000Z",
      copiesByPosition: {
        [unknownKey]: 1,
      },
    });

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: "unknown-position" }],
    });
  });

  it("normalizes zero quantities out of the restored collection", () => {
    const result = validateCollectionBackup({
      type: COLLECTION_BACKUP_TYPE,
      formatVersion: 1,
      exportedAt: "2026-07-15T12:00:00.000Z",
      copiesByPosition: {
        [makePositionKey(argentina7)]: 0,
        [makePositionKey(mexico1)]: 2,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(getCopies(result.value.collection, argentina7)).toBe(0);
      expect(getCopies(result.value.collection, mexico1)).toBe(2);
      expect(result.value.backup.copiesByPosition).toEqual({
        [makePositionKey(mexico1)]: 2,
      });
    }
  });

  it("builds an ordered file name", () => {
    expect(buildCollectionBackupFileName(exportedAt)).toBe(
      "figus-pani-backup-2026-07-15.json",
    );
  });
});
