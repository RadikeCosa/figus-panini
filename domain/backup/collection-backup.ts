import {
  getDuplicateCopyCount,
  getPhysicalCopyCount,
  getUniqueOwnedCount,
  listDuplicatePositions,
  listMissingPositions,
  normalizeCollection,
  type CollectionState,
  type PositionKey,
} from "../collection/collection";

export const COLLECTION_BACKUP_TYPE = "figus-pani-backup";
export const COLLECTION_BACKUP_FORMAT_VERSION = 1;

export type CollectionBackupV1 = {
  type: typeof COLLECTION_BACKUP_TYPE;
  formatVersion: typeof COLLECTION_BACKUP_FORMAT_VERSION;
  exportedAt: string;
  copiesByPosition: Record<PositionKey, number>;
};

export type CollectionBackupSummary = {
  exportedAt: string;
  uniqueOwned: number;
  missing: number;
  duplicateCopies: number;
  physicalCopies: number;
  duplicatePositions: number;
};

export type ValidCollectionBackup = {
  backup: CollectionBackupV1;
  collection: CollectionState;
  summary: CollectionBackupSummary;
};

export type CollectionBackupValidationIssue = {
  code:
    | "malformed-json"
    | "root-not-object"
    | "invalid-type"
    | "unsupported-version"
    | "invalid-exported-at"
    | "missing-copies"
    | "invalid-copies"
    | "invalid-entry"
    | "unknown-position"
    | "invalid-quantity"
    | "duplicate-position";
  message: string;
};

export type ParseCollectionBackupResult =
  | { ok: true; value: ValidCollectionBackup }
  | { ok: false; issues: CollectionBackupValidationIssue[] };

export function createCollectionBackup(
  collection: CollectionState,
  exportedAt: Date = new Date(),
): CollectionBackupV1 {
  return {
    type: COLLECTION_BACKUP_TYPE,
    formatVersion: COLLECTION_BACKUP_FORMAT_VERSION,
    exportedAt: exportedAt.toISOString(),
    copiesByPosition: sortCopiesByPosition(collection.copiesByPosition),
  };
}

export function serializeCollectionBackup(backup: CollectionBackupV1): string {
  return `${JSON.stringify(
    {
      ...backup,
      copiesByPosition: sortCopiesByPosition(backup.copiesByPosition),
    },
    null,
    2,
  )}\n`;
}

export function parseCollectionBackupText(
  text: string,
): ParseCollectionBackupResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      issues: [{ code: "malformed-json", message: "El archivo no es JSON válido." }],
    };
  }

  return validateCollectionBackup(parsed);
}

export function validateCollectionBackup(
  input: unknown,
): ParseCollectionBackupResult {
  const issues: CollectionBackupValidationIssue[] = [];

  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [
        {
          code: "root-not-object",
          message: "El respaldo debe ser un objeto JSON.",
        },
      ],
    };
  }

  if (input.type !== COLLECTION_BACKUP_TYPE) {
    issues.push({
      code: "invalid-type",
      message: "El archivo no corresponde a un respaldo de Figus Pani.",
    });
  }

  if (input.formatVersion !== COLLECTION_BACKUP_FORMAT_VERSION) {
    issues.push({
      code: "unsupported-version",
      message: "La versión del respaldo no está soportada.",
    });
  }

  if (typeof input.exportedAt !== "string" || !isValidIsoDate(input.exportedAt)) {
    issues.push({
      code: "invalid-exported-at",
      message: "La fecha de exportación no es válida.",
    });
  }

  if (!("copiesByPosition" in input)) {
    issues.push({
      code: "missing-copies",
      message: "El respaldo no contiene copias.",
    });
  } else if (!isRecord(input.copiesByPosition) || Array.isArray(input.copiesByPosition)) {
    issues.push({
      code: "invalid-copies",
      message: "Las copias del respaldo no tienen un formato válido.",
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const normalized = normalizeCollection(input.copiesByPosition);

  if (normalized.issues.length > 0) {
    return {
      ok: false,
      issues: normalized.issues.map((issue) => ({
        code: issue.type,
        message: formatNormalizationIssue(issue.type),
      })),
    };
  }

  const exportedAt = input.exportedAt as string;
  const collection = normalized.collection;
  const backup: CollectionBackupV1 = {
    type: COLLECTION_BACKUP_TYPE,
    formatVersion: COLLECTION_BACKUP_FORMAT_VERSION,
    exportedAt,
    copiesByPosition: sortCopiesByPosition(collection.copiesByPosition),
  };

  return {
    ok: true,
    value: {
      backup,
      collection,
      summary: buildCollectionBackupSummary(collection, exportedAt),
    },
  };
}

export function buildCollectionBackupSummary(
  collection: CollectionState,
  exportedAt: string,
): CollectionBackupSummary {
  return {
    exportedAt,
    uniqueOwned: getUniqueOwnedCount(collection),
    missing: listMissingPositions(collection).length,
    duplicateCopies: getDuplicateCopyCount(collection),
    physicalCopies: getPhysicalCopyCount(collection),
    duplicatePositions: listDuplicatePositions(collection).length,
  };
}

export function buildCollectionBackupFileName(exportedAt: Date): string {
  return `figus-pani-backup-${exportedAt.toISOString().slice(0, 10)}.json`;
}

function sortCopiesByPosition(
  copiesByPosition: Readonly<Record<PositionKey, number>>,
): Record<PositionKey, number> {
  return Object.fromEntries(
    Object.entries(copiesByPosition).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}

function isValidIsoDate(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatNormalizationIssue(
  issue: "unknown-position" | "invalid-quantity" | "duplicate-position" | "invalid-entry",
): string {
  switch (issue) {
    case "unknown-position":
      return "El respaldo contiene una posición desconocida.";
    case "invalid-quantity":
      return "El respaldo contiene una cantidad inválida.";
    case "duplicate-position":
      return "El respaldo contiene una posición duplicada.";
    case "invalid-entry":
      return "El respaldo contiene una entrada corrupta.";
  }
}
