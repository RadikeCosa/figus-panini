import { expandCanonicalAlbumPositions } from "../album/canonical-album";

export type AlbumPosition = {
  section: string;
  position: string;
  globalOrder: number;
};

export type PositionRef = {
  section: string;
  position: string;
};

export type PositionKey = string;

export type CollectionState = {
  copiesByPosition: Readonly<Record<PositionKey, number>>;
};

export type Progress = {
  owned: number;
  total: number;
};

export type SectionProgress = Progress & {
  section: string;
};

export type NormalizationIssue =
  | {
      type: "unknown-position";
      key?: string;
      position?: PositionRef;
    }
  | {
      type: "invalid-quantity";
      key?: string;
      position?: PositionRef;
      value: unknown;
    }
  | {
      type: "duplicate-position";
      key: PositionKey;
      position: PositionRef;
    }
  | {
      type: "invalid-entry";
      value: unknown;
    };

export type NormalizeCollectionResult = {
  collection: CollectionState;
  issues: NormalizationIssue[];
};

export class CollectionDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CollectionDomainError";
  }
}

const CANONICAL_POSITIONS = expandCanonicalAlbumPositions();
const CANONICAL_KEYS = new Set(
  CANONICAL_POSITIONS.map((position) => makePositionKey(position)),
);

const POSITIONS_BY_SECTION = CANONICAL_POSITIONS.reduce<
  Record<string, AlbumPosition[]>
>((groups, position) => {
  groups[position.section] = [...(groups[position.section] ?? []), position];
  return groups;
}, {});

export function makePositionKey({ section, position }: PositionRef): PositionKey {
  return `${encodeURIComponent(section)}|${encodeURIComponent(position)}`;
}

export function parsePositionKey(key: PositionKey): PositionRef {
  const parts = key.split("|");

  if (parts.length !== 2) {
    throw new CollectionDomainError(`La clave de posición no es válida: ${key}`);
  }

  try {
    return {
      section: decodeURIComponent(parts[0]),
      position: decodeURIComponent(parts[1]),
    };
  } catch {
    throw new CollectionDomainError(`La clave de posición no es válida: ${key}`);
  }
}

export function createEmptyCollection(): CollectionState {
  return { copiesByPosition: {} };
}

export function getCopies(
  collection: CollectionState,
  position: PositionRef,
): number {
  assertKnownPosition(position);
  return collection.copiesByPosition[makePositionKey(position)] ?? 0;
}

export function setCopies(
  collection: CollectionState,
  position: PositionRef,
  copies: number,
): CollectionState {
  assertKnownPosition(position);
  assertValidQuantity(copies);

  const key = makePositionKey(position);
  const nextCopiesByPosition = { ...collection.copiesByPosition };

  if (copies === 0) {
    delete nextCopiesByPosition[key];
  } else {
    nextCopiesByPosition[key] = copies;
  }

  return { copiesByPosition: nextCopiesByPosition };
}

export function addCopy(
  collection: CollectionState,
  position: PositionRef,
): CollectionState {
  return setCopies(collection, position, getCopies(collection, position) + 1);
}

export function removeCopy(
  collection: CollectionState,
  position: PositionRef,
): CollectionState {
  return setCopies(
    collection,
    position,
    Math.max(getCopies(collection, position) - 1, 0),
  );
}

export function isOwned(
  collection: CollectionState,
  position: PositionRef,
): boolean {
  return getCopies(collection, position) >= 1;
}

export function isMissing(
  collection: CollectionState,
  position: PositionRef,
): boolean {
  return getCopies(collection, position) === 0;
}

export function getDuplicateCopies(
  collection: CollectionState,
  position: PositionRef,
): number {
  return Math.max(getCopies(collection, position) - 1, 0);
}

export function listMissingPositions(collection: CollectionState): AlbumPosition[] {
  return CANONICAL_POSITIONS.filter((position) => isMissing(collection, position));
}

export function listDuplicatePositions(collection: CollectionState): AlbumPosition[] {
  return CANONICAL_POSITIONS.filter(
    (position) => getDuplicateCopies(collection, position) > 0,
  );
}

export function getGlobalProgress(collection: CollectionState): Progress {
  return {
    owned: getUniqueOwnedCount(collection),
    total: CANONICAL_POSITIONS.length,
  };
}

export function getSectionProgress(
  collection: CollectionState,
  section: string,
): SectionProgress {
  const positions = POSITIONS_BY_SECTION[section];

  if (!positions) {
    throw new CollectionDomainError(`La sección ${section} no existe en el álbum.`);
  }

  return {
    section,
    owned: positions.filter((position) => isOwned(collection, position)).length,
    total: positions.length,
  };
}

export function getPhysicalCopyCount(collection: CollectionState): number {
  return Object.values(collection.copiesByPosition).reduce(
    (total, copies) => total + copies,
    0,
  );
}

export function getUniqueOwnedCount(collection: CollectionState): number {
  return Object.values(collection.copiesByPosition).filter((copies) => copies >= 1)
    .length;
}

export function getDuplicateCopyCount(collection: CollectionState): number {
  return Object.values(collection.copiesByPosition).reduce(
    (total, copies) => total + Math.max(copies - 1, 0),
    0,
  );
}

export function normalizeCollection(input: unknown): NormalizeCollectionResult {
  const issues: NormalizationIssue[] = [];
  let collection = createEmptyCollection();

  for (const entry of readUnknownEntries(input, issues)) {
    const { position, value, key } = entry;

    if (!isKnownPosition(position)) {
      issues.push({ type: "unknown-position", key, position });
      continue;
    }

    if (!isValidQuantity(value)) {
      issues.push({ type: "invalid-quantity", key, position, value });
      continue;
    }

    if (value === 0) {
      continue;
    }

    collection = setCopies(collection, position, value);
  }

  return { collection, issues };
}

function assertKnownPosition(position: PositionRef): void {
  if (!isKnownPosition(position)) {
    throw new CollectionDomainError(
      `La posición ${position.section}-${position.position} no existe en el álbum.`,
    );
  }
}

function isKnownPosition(position: PositionRef): boolean {
  return CANONICAL_KEYS.has(makePositionKey(position));
}

function assertValidQuantity(copies: number): void {
  if (!isValidQuantity(copies)) {
    throw new CollectionDomainError(
      `La cantidad debe ser un entero no negativo: ${String(copies)}.`,
    );
  }
}

function isValidQuantity(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

type UnknownEntry = {
  key?: string;
  position: PositionRef;
  value: unknown;
};

function readUnknownEntries(
  input: unknown,
  issues: NormalizationIssue[],
): UnknownEntry[] {
  if (Array.isArray(input)) {
    return readArrayEntries(input, issues);
  }

  if (isRecord(input)) {
    return Object.entries(input).flatMap(([key, value]) => {
      try {
        return [{ key, position: parsePositionKey(key), value }];
      } catch {
        issues.push({ type: "invalid-entry", value: { key, value } });
        return [];
      }
    });
  }

  issues.push({ type: "invalid-entry", value: input });
  return [];
}

function readArrayEntries(
  input: unknown[],
  issues: NormalizationIssue[],
): UnknownEntry[] {
  const seenKeys = new Set<PositionKey>();
  const entries: UnknownEntry[] = [];

  for (const value of input) {
    if (!isRecord(value)) {
      issues.push({ type: "invalid-entry", value });
      continue;
    }

    const section = value.section;
    const position = value.position;

    if (typeof section !== "string" || typeof position !== "string") {
      issues.push({ type: "invalid-entry", value });
      continue;
    }

    const key = makePositionKey({ section, position });

    if (seenKeys.has(key)) {
      issues.push({
        type: "duplicate-position",
        key,
        position: { section, position },
      });
      continue;
    }

    seenKeys.add(key);
    entries.push({ key, position: { section, position }, value: value.copies });
  }

  return entries;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
