import { SELECTION_GROUPS } from "../album/canonical-album";
import {
  getGlobalProgress,
  listMissingPositions,
  type AlbumPosition,
  type CollectionState,
} from "./collection";

export type MissingListDocumentSection = {
  section: string;
  group: string | null;
  positions: string[];
};

export type MissingListDocument = {
  generatedAt: Date;
  totalCount: number;
  ownedCount: number;
  missingCount: number;
  sections: MissingListDocumentSection[];
};

const SELECTION_GROUP_BY_SECTION = new Map<string, string>(
  SELECTION_GROUPS.flatMap(({ group, sections }) =>
    sections.map((section) => [section, group] as const),
  ),
);

export function buildMissingListDocument(
  collection: CollectionState,
  generatedAt: Date,
): MissingListDocument {
  const missingPositions = listMissingPositions(collection);
  const progress = getGlobalProgress(collection);

  return {
    generatedAt,
    totalCount: progress.total,
    ownedCount: progress.owned,
    missingCount: missingPositions.length,
    sections: groupMissingPositionsBySection(missingPositions),
  };
}

function groupMissingPositionsBySection(
  positions: AlbumPosition[],
): MissingListDocumentSection[] {
  const sections: MissingListDocumentSection[] = [];

  for (const position of positions) {
    const currentSection = sections.at(-1);

    if (currentSection?.section === position.section) {
      currentSection.positions.push(position.position);
      continue;
    }

    sections.push({
      section: position.section,
      group: SELECTION_GROUP_BY_SECTION.get(position.section) ?? null,
      positions: [position.position],
    });
  }

  return sections;
}
