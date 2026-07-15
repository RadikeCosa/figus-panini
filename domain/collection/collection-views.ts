import {
  SELECTION_GROUPS,
  SPECIAL_SECTIONS,
} from "../album/canonical-album";
import {
  getCopies,
  getDuplicateCopies,
  getGlobalProgress,
  getSectionProgress,
  listDuplicatePositions,
  listMissingPositions,
  type AlbumPosition,
  type CollectionState,
  type Progress,
} from "./collection";

export type CollectionSectionOption = {
  section: string;
  group: string;
  type: "special" | "selection";
};

export type MissingSectionView = {
  section: string;
  group: string;
  positions: AlbumPosition[];
  missing: number;
  owned: number;
  total: number;
  percentage: number;
};

export type DuplicatePositionView = AlbumPosition & {
  copies: number;
  duplicateCopies: number;
};

export type DuplicateSectionView = {
  section: string;
  group: string;
  positions: DuplicatePositionView[];
  duplicatePositionCount: number;
  duplicateCopyCount: number;
};

export type MissingCollectionView = {
  progress: Progress;
  totalMissing: number;
  sections: MissingSectionView[];
};

export type DuplicateCollectionView = {
  duplicatePositionCount: number;
  duplicateCopyCount: number;
  sections: DuplicateSectionView[];
};

const SECTION_OPTIONS: CollectionSectionOption[] = [
  ...SPECIAL_SECTIONS.map(({ section }) => ({
    section,
    group: "Especiales",
    type: "special" as const,
  })),
  ...SELECTION_GROUPS.flatMap(({ group, sections }) =>
    sections.map((section) => ({
      section,
      group,
      type: "selection" as const,
    })),
  ),
];

const SECTION_GROUP_BY_NAME = new Map(
  SECTION_OPTIONS.map(({ group, section }) => [section, group]),
);

export function listCollectionSectionOptions(): CollectionSectionOption[] {
  return SECTION_OPTIONS.map((option) => ({ ...option }));
}

export function buildAlbumSectionHref(section: string): string {
  return `/album?section=${encodeURIComponent(section)}`;
}

export function buildMissingCollectionView(
  collection: CollectionState,
): MissingCollectionView {
  const missingPositions = listMissingPositions(collection);
  const sections = groupPositionsBySection(missingPositions).map(
    ({ section, positions }) => {
      const progress = getSectionProgress(collection, section);

      return {
        section,
        group: getSectionGroup(section),
        positions,
        missing: positions.length,
        owned: progress.owned,
        total: progress.total,
        percentage:
          progress.total === 0
            ? 0
            : Math.round((progress.owned / progress.total) * 100),
      };
    },
  );

  return {
    progress: getGlobalProgress(collection),
    totalMissing: missingPositions.length,
    sections,
  };
}

export function buildDuplicateCollectionView(
  collection: CollectionState,
): DuplicateCollectionView {
  const duplicatePositions = listDuplicatePositions(collection).map((position) => ({
    ...position,
    copies: getCopies(collection, position),
    duplicateCopies: getDuplicateCopies(collection, position),
  }));
  const sections = groupPositionsBySection(duplicatePositions).map(
    ({ section, positions }) => ({
      section,
      group: getSectionGroup(section),
      positions,
      duplicatePositionCount: positions.length,
      duplicateCopyCount: positions.reduce(
        (total, position) => total + position.duplicateCopies,
        0,
      ),
    }),
  );

  return {
    duplicatePositionCount: duplicatePositions.length,
    duplicateCopyCount: duplicatePositions.reduce(
      (total, position) => total + position.duplicateCopies,
      0,
    ),
    sections,
  };
}

function groupPositionsBySection<TPosition extends AlbumPosition>(
  positions: TPosition[],
): Array<{ section: string; positions: TPosition[] }> {
  const grouped = new Map<string, TPosition[]>();

  for (const position of positions) {
    grouped.set(position.section, [
      ...(grouped.get(position.section) ?? []),
      position,
    ]);
  }

  return SECTION_OPTIONS.flatMap(({ section }) => {
    const sectionPositions = grouped.get(section);
    return sectionPositions ? [{ section, positions: sectionPositions }] : [];
  });
}

function getSectionGroup(section: string): string {
  return SECTION_GROUP_BY_NAME.get(section) ?? "Especiales";
}
