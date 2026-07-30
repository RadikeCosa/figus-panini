import {
  SELECTION_SECTIONS,
  expandCanonicalAlbumPositions,
} from "../album/canonical-album";
import {
  getDuplicateCopies,
  getDuplicateCopyCount,
  getGlobalProgress,
  getSectionProgress,
  listMissingPositions,
  type AlbumPosition,
  type CollectionState,
} from "./collection";

export type SelectionCollectionSummary = {
  section: string;
  owned: number;
  total: 20;
  missing: number;
  percentage: number;
  duplicateCopyCount: number;
  complete: boolean;
};

export type GlobalMilestone = {
  target: number;
  current: number;
  remaining: number;
};

export type CollectionInsights = {
  selectionSummaries: SelectionCollectionSummary[];
  startedSelectionCount: number;
  completedSelectionCount: number;
  completedSelections: SelectionCollectionSummary[];
  mostAdvancedIncompleteSelections: SelectionCollectionSummary[];
  closestToCompletionSelections: SelectionCollectionSummary[];
  totalDuplicateCopyCount: number;
  totalMissingCount: number;
  nextGlobalMilestone: GlobalMilestone | null;
};

const GLOBAL_MILESTONES = [10, 25, 50, 100, 200, 350, 500, 650, 800, 900, 950, 980];
const SELECTION_TOTAL = 20;
const CLOSE_TO_COMPLETION_MINIMUM = 15;
const SELECTION_SECTION_SET = new Set<string>(SELECTION_SECTIONS);

const POSITIONS_BY_SELECTION = expandCanonicalAlbumPositions().reduce<
  Record<string, AlbumPosition[]>
>((groups, position) => {
  if (!SELECTION_SECTION_SET.has(position.section)) {
    return groups;
  }

  groups[position.section] = [...(groups[position.section] ?? []), position];
  return groups;
}, {});

export function buildCollectionInsights(
  collection: CollectionState,
): CollectionInsights {
  const selectionSummaries = buildSelectionSummaries(collection);
  const completedSelections = selectionSummaries.filter(({ complete }) => complete);
  const incompleteSelections = selectionSummaries.filter(({ complete }) => !complete);

  return {
    selectionSummaries,
    startedSelectionCount: selectionSummaries.filter(({ owned }) => owned > 0).length,
    completedSelectionCount: completedSelections.length,
    completedSelections,
    mostAdvancedIncompleteSelections:
      listMostAdvancedIncompleteSelections(incompleteSelections),
    closestToCompletionSelections:
      listClosestToCompletionSelections(incompleteSelections),
    totalDuplicateCopyCount: getDuplicateCopyCount(collection),
    totalMissingCount: listMissingPositions(collection).length,
    nextGlobalMilestone: getNextGlobalMilestone(collection),
  };
}

function buildSelectionSummaries(
  collection: CollectionState,
): SelectionCollectionSummary[] {
  return SELECTION_SECTIONS.map((section) => {
    const progress = getSectionProgress(collection, section);
    const positions = POSITIONS_BY_SELECTION[section] ?? [];
    const duplicateCopyCount = positions.reduce(
      (total, position) => total + getDuplicateCopies(collection, position),
      0,
    );
    const missing = progress.total - progress.owned;

    return {
      section,
      owned: progress.owned,
      total: SELECTION_TOTAL,
      missing,
      percentage: Math.round((progress.owned / progress.total) * 100),
      duplicateCopyCount,
      complete: missing === 0,
    };
  });
}

function listMostAdvancedIncompleteSelections(
  summaries: SelectionCollectionSummary[],
): SelectionCollectionSummary[] {
  const highestOwned = Math.max(...summaries.map(({ owned }) => owned));

  return summaries.filter(({ owned }) => owned === highestOwned);
}

function listClosestToCompletionSelections(
  summaries: SelectionCollectionSummary[],
): SelectionCollectionSummary[] {
  const eligibleSummaries = summaries.filter(
    ({ owned }) => owned >= CLOSE_TO_COMPLETION_MINIMUM,
  );

  if (eligibleSummaries.length === 0) {
    return [];
  }

  const lowestMissing = Math.min(
    ...eligibleSummaries.map(({ missing }) => missing),
  );

  return eligibleSummaries.filter(({ missing }) => missing === lowestMissing);
}

function getNextGlobalMilestone(collection: CollectionState): GlobalMilestone | null {
  const progress = getGlobalProgress(collection);

  if (progress.owned >= progress.total) {
    return null;
  }

  const target = GLOBAL_MILESTONES.find((milestone) => milestone > progress.owned);

  if (!target) {
    return null;
  }

  return {
    target,
    current: progress.owned,
    remaining: target - progress.owned,
  };
}
