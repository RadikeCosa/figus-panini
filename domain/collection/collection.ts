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

export type ResolveSectionResult =
  | { status: "found"; section: string }
  | { status: "not-found"; sectionInput: string }
  | { status: "ambiguous"; sectionInput: string; matches: string[] };

export type PositionQueryResult =
  | { status: "empty-query" }
  | { status: "missing-position-number"; sectionInput: string }
  | { status: "section-not-found"; sectionInput: string }
  | { status: "section-ambiguous"; sectionInput: string; matches: string[] }
  | { status: "non-numeric-position"; sectionInput: string; positionInput: string }
  | {
      status: "position-out-of-range";
      section: string;
      positionInput: string;
      allowedPositions: string[];
    }
  | {
      status: "found";
      position: PositionRef;
      copies: number;
      duplicateCopies: number;
      ownership: "missing" | "owned" | "duplicate";
    };

export type SectionSuggestionQuery = {
  sectionInput: string;
  positionInput: string | null;
};

export type SectionSuggestion = {
  section: string;
  value: string;
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

const CANONICAL_SECTIONS = Object.keys(POSITIONS_BY_SECTION);

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

export function listCanonicalSections(): string[] {
  return [...CANONICAL_SECTIONS];
}

export function normalizeSectionText(input: string): string {
  return input
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es");
}

export function resolveCanonicalSection(input: string): ResolveSectionResult {
  const normalizedInput = normalizeSectionText(input);

  if (normalizedInput === "") {
    return { status: "not-found", sectionInput: input };
  }

  const matches = CANONICAL_SECTIONS.filter(
    (section) => normalizeSectionText(section) === normalizedInput,
  );

  if (matches.length === 0) {
    return { status: "not-found", sectionInput: input };
  }

  if (matches.length > 1) {
    return { status: "ambiguous", sectionInput: input, matches };
  }

  return { status: "found", section: matches[0] };
}

export function parseSectionSuggestionQuery(query: string): SectionSuggestionQuery {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");

  if (normalizedQuery === "") {
    return { sectionInput: "", positionInput: null };
  }

  const queryParts = normalizedQuery.match(/^(.*\S)\s+(\d+)$/);

  if (!queryParts) {
    return { sectionInput: normalizedQuery, positionInput: null };
  }

  return {
    sectionInput: queryParts[1],
    positionInput: queryParts[2],
  };
}

export function getCanonicalSectionSuggestions(
  query: string,
  limit = 6,
): SectionSuggestion[] {
  const partialQuery = parseSectionSuggestionQuery(query);
  const normalizedSectionInput = normalizeSectionText(partialQuery.sectionInput);

  if (normalizedSectionInput === "") {
    return [];
  }

  if (isCompleteValidPositionQuery(partialQuery)) {
    return [];
  }

  const prefixMatches = CANONICAL_SECTIONS.filter((section) =>
    normalizeSectionText(section).startsWith(normalizedSectionInput),
  );
  const prefixSet = new Set(prefixMatches);
  const contentMatches = CANONICAL_SECTIONS.filter(
    (section) =>
      !prefixSet.has(section) &&
      normalizeSectionText(section).includes(normalizedSectionInput),
  );

  return [...prefixMatches, ...contentMatches].slice(0, limit).map((section) => ({
    section,
    value: buildSectionSuggestionValue(partialQuery, section),
  }));
}

export function parsePositionQuery(
  query: string,
  collection: CollectionState,
): PositionQueryResult {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");

  if (normalizedQuery === "") {
    return { status: "empty-query" };
  }

  const fullSection = resolveCanonicalSection(normalizedQuery);

  if (fullSection.status === "found") {
    return { status: "missing-position-number", sectionInput: normalizedQuery };
  }

  const queryParts = normalizedQuery.match(/^(.*\S)\s+(\S+)$/);

  if (!queryParts) {
    return { status: "missing-position-number", sectionInput: normalizedQuery };
  }

  const [, sectionInput, positionInput] = queryParts;
  const resolvedSection = resolveCanonicalSection(sectionInput);

  if (resolvedSection.status === "not-found") {
    return { status: "section-not-found", sectionInput };
  }

  if (resolvedSection.status === "ambiguous") {
    return {
      status: "section-ambiguous",
      sectionInput: resolvedSection.sectionInput,
      matches: resolvedSection.matches,
    };
  }

  if (!/^\d+$/.test(positionInput)) {
    return { status: "non-numeric-position", sectionInput, positionInput };
  }

  const positionValidation = validateCanonicalPosition(
    resolvedSection.section,
    positionInput,
  );

  if (!positionValidation.valid) {
    return {
      status: "position-out-of-range",
      section: resolvedSection.section,
      positionInput,
      allowedPositions: positionValidation.allowedPositions,
    };
  }

  return getPositionCollectionStatus(collection, {
    section: resolvedSection.section,
    position: positionValidation.position,
  });
}

export function buildSectionSuggestionValue(
  query: SectionSuggestionQuery,
  section: string,
): string {
  return query.positionInput === null
    ? `${section} `
    : `${section} ${query.positionInput}`;
}

export function validatePositionExists(
  section: string,
  positionInput: string,
): { valid: true; position: PositionRef } | { valid: false; allowedPositions: string[] } {
  const validation = validateCanonicalPosition(section, positionInput);

  if (!validation.valid) {
    return validation;
  }

  return {
    valid: true,
    position: {
      section,
      position: validation.position,
    },
  };
}

export function getPositionCollectionStatus(
  collection: CollectionState,
  position: PositionRef,
): Extract<PositionQueryResult, { status: "found" }> {
  const copies = getCopies(collection, position);
  const duplicateCopies = Math.max(copies - 1, 0);
  const ownership =
    copies === 0 ? "missing" : duplicateCopies > 0 ? "duplicate" : "owned";

  return {
    status: "found",
    position,
    copies,
    duplicateCopies,
    ownership,
  };
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

function validateCanonicalPosition(
  section: string,
  positionInput: string,
): { valid: true; position: string } | { valid: false; allowedPositions: string[] } {
  const positions = POSITIONS_BY_SECTION[section];

  if (!positions) {
    return { valid: false, allowedPositions: [] };
  }

  const allowedPositions = positions.map(({ position }) => position);
  const canonicalPosition =
    section === "PANINI" ? positionInput : String(Number(positionInput));

  if (!allowedPositions.includes(canonicalPosition)) {
    return { valid: false, allowedPositions };
  }

  return { valid: true, position: canonicalPosition };
}

function isCompleteValidPositionQuery(query: SectionSuggestionQuery): boolean {
  if (query.positionInput === null) {
    return false;
  }

  const resolvedSection = resolveCanonicalSection(query.sectionInput);

  if (resolvedSection.status !== "found") {
    return false;
  }

  return validateCanonicalPosition(
    resolvedSection.section,
    query.positionInput,
  ).valid;
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
