import { describe, expect, it } from "vitest";
import { expandCanonicalAlbumPositions } from "../album/canonical-album";
import {
  createEmptyCollection,
  setCopies,
  type CollectionState,
} from "./collection";
import { buildCollectionInsights } from "./collection-insights";

const panini = { section: "PANINI", position: "00" };
const fwc1 = { section: "FWC", position: "1" };
const mexico1 = { section: "México", position: "1" };
const mexico2 = { section: "México", position: "2" };
const argentina1 = { section: "Argentina", position: "1" };
const brasil1 = { section: "Brasil", position: "1" };

describe("collection insights", () => {
  it("summarizes an empty collection without special sections in selection rankings", () => {
    const insights = buildCollectionInsights(createEmptyCollection());

    expect(insights.selectionSummaries).toHaveLength(48);
    expect(insights.selectionSummaries[0]).toEqual({
      section: "México",
      owned: 0,
      total: 20,
      missing: 20,
      percentage: 0,
      duplicateCopyCount: 0,
      complete: false,
    });
    expect(insights.selectionSummaries.map(({ section }) => section)).not.toContain(
      "PANINI",
    );
    expect(insights.selectionSummaries.map(({ section }) => section)).not.toContain(
      "FWC",
    );
    expect(insights.startedSelectionCount).toBe(0);
    expect(insights.completedSelectionCount).toBe(0);
    expect(insights.completedSelections).toEqual([]);
    expect(insights.mostAdvancedIncompleteSelections).toHaveLength(48);
    expect(insights.closestToCompletionSelections).toEqual([]);
    expect(insights.totalDuplicateCopyCount).toBe(0);
    expect(insights.totalMissingCount).toBe(980);
    expect(insights.nextGlobalMilestone).toEqual({
      target: 10,
      current: 0,
      remaining: 10,
    });
  });

  it("summarizes a collection with one figurita", () => {
    const collection = setCopies(createEmptyCollection(), mexico1, 1);
    const insights = buildCollectionInsights(collection);
    const mexico = getSelection(insights, "México");

    expect(mexico).toMatchObject({
      owned: 1,
      total: 20,
      missing: 19,
      percentage: 5,
      duplicateCopyCount: 0,
      complete: false,
    });
    expect(insights.startedSelectionCount).toBe(1);
    expect(insights.mostAdvancedIncompleteSelections.map(({ section }) => section)).toEqual([
      "México",
    ]);
    expect(insights.closestToCompletionSelections).toEqual([]);
    expect(insights.nextGlobalMilestone).toEqual({
      target: 10,
      current: 1,
      remaining: 9,
    });
  });

  it("keeps less than 10 pegadas below the first milestone", () => {
    const collection = withFirstPositions(createEmptyCollection(), "México", 9);
    const insights = buildCollectionInsights(collection);

    expect(getSelection(insights, "México").owned).toBe(9);
    expect(insights.nextGlobalMilestone).toEqual({
      target: 10,
      current: 9,
      remaining: 1,
    });
  });

  it("counts several started selections", () => {
    const collection = setCopies(
      setCopies(setCopies(createEmptyCollection(), mexico1, 1), argentina1, 1),
      brasil1,
      1,
    );

    expect(buildCollectionInsights(collection).startedSelectionCount).toBe(3);
  });

  it("marks a selection with 15 of 20 as close to completion", () => {
    const insights = buildCollectionInsights(
      withFirstPositions(createEmptyCollection(), "México", 15),
    );

    expect(insights.closestToCompletionSelections.map(({ section }) => section)).toEqual([
      "México",
    ]);
    expect(getSelection(insights, "México")).toMatchObject({
      owned: 15,
      missing: 5,
      percentage: 75,
      complete: false,
    });
  });

  it("keeps a selection with 19 of 20 incomplete and closest", () => {
    const insights = buildCollectionInsights(
      withFirstPositions(createEmptyCollection(), "Argentina", 19),
    );

    expect(insights.closestToCompletionSelections.map(({ section, missing }) => [
      section,
      missing,
    ])).toEqual([["Argentina", 1]]);
    expect(getSelection(insights, "Argentina").complete).toBe(false);
  });

  it("marks a complete selection as exactly 20 of 20", () => {
    const insights = buildCollectionInsights(
      withFirstPositions(createEmptyCollection(), "México", 20),
    );
    const mexico = getSelection(insights, "México");

    expect(mexico).toMatchObject({
      owned: 20,
      total: 20,
      missing: 0,
      percentage: 100,
      complete: true,
    });
    expect(insights.completedSelectionCount).toBe(1);
    expect(insights.completedSelections.map(({ section }) => section)).toEqual([
      "México",
    ]);
    expect(insights.closestToCompletionSelections).toEqual([]);
  });

  it("keeps several complete selections in canonical order", () => {
    const collection = withFirstPositions(
      withFirstPositions(createEmptyCollection(), "Brasil", 20),
      "México",
      20,
    );
    const insights = buildCollectionInsights(collection);

    expect(insights.completedSelectionCount).toBe(2);
    expect(insights.completedSelections.map(({ section }) => section)).toEqual([
      "México",
      "Brasil",
    ]);
  });

  it("keeps real ties between selections in canonical order", () => {
    const collection = withFirstPositions(
      withFirstPositions(createEmptyCollection(), "Brasil", 5),
      "México",
      5,
    );
    const insights = buildCollectionInsights(collection);

    expect(insights.mostAdvancedIncompleteSelections.map(({ section }) => section)).toEqual([
      "México",
      "Brasil",
    ]);
  });

  it("keeps all selections when every incomplete selection is tied", () => {
    const insights = buildCollectionInsights(createEmptyCollection());

    expect(insights.mostAdvancedIncompleteSelections).toHaveLength(48);
    expect(insights.mostAdvancedIncompleteSelections[0].section).toBe("México");
    expect(insights.mostAdvancedIncompleteSelections.at(-1)?.section).toBe("Panamá");
  });

  it("counts repeated copies concentrated in one position", () => {
    const collection = setCopies(createEmptyCollection(), mexico1, 6);
    const insights = buildCollectionInsights(collection);

    expect(getSelection(insights, "México")).toMatchObject({
      owned: 1,
      missing: 19,
      duplicateCopyCount: 5,
    });
    expect(insights.totalDuplicateCopyCount).toBe(5);
  });

  it("counts repeated copies distributed between several selections", () => {
    const collection = setCopies(
      setCopies(createEmptyCollection(), mexico1, 3),
      argentina1,
      4,
    );
    const insights = buildCollectionInsights(collection);

    expect(getSelection(insights, "México").duplicateCopyCount).toBe(2);
    expect(getSelection(insights, "Argentina").duplicateCopyCount).toBe(3);
    expect(insights.totalDuplicateCopyCount).toBe(5);
  });

  it("does not let many physical copies inflate unique progress", () => {
    const collection = setCopies(createEmptyCollection(), mexico1, 20);
    const insights = buildCollectionInsights(collection);

    expect(getSelection(insights, "México")).toMatchObject({
      owned: 1,
      missing: 19,
      duplicateCopyCount: 19,
      percentage: 5,
    });
    expect(insights.nextGlobalMilestone).toEqual({
      target: 10,
      current: 1,
      remaining: 9,
    });
  });

  it("summarizes an almost complete album", () => {
    const collection = expandCanonicalAlbumPositions().reduce((current, position) => {
      if (
        (position.section === "Panamá" && position.position === "20") ||
        (position.section === "FWC" && position.position === "19")
      ) {
        return current;
      }

      return setCopies(current, position, 1);
    }, createEmptyCollection());
    const insights = buildCollectionInsights(collection);

    expect(insights.totalMissingCount).toBe(2);
    expect(insights.completedSelectionCount).toBe(47);
    expect(insights.closestToCompletionSelections.map(({ section, missing }) => [
      section,
      missing,
    ])).toEqual([["Panamá", 1]]);
    expect(insights.nextGlobalMilestone).toEqual({
      target: 980,
      current: 978,
      remaining: 2,
    });
  });

  it("returns no next milestone for a complete album", () => {
    const collection = expandCanonicalAlbumPositions().reduce(
      (current, position) => setCopies(current, position, 1),
      createEmptyCollection(),
    );
    const insights = buildCollectionInsights(collection);

    expect(insights.totalMissingCount).toBe(0);
    expect(insights.completedSelectionCount).toBe(48);
    expect(insights.mostAdvancedIncompleteSelections).toEqual([]);
    expect(insights.closestToCompletionSelections).toEqual([]);
    expect(insights.nextGlobalMilestone).toBeNull();
  });

  it("excludes PANINI and FWC from selection summaries while counting global totals", () => {
    const collection = setCopies(
      setCopies(setCopies(createEmptyCollection(), panini, 2), fwc1, 1),
      mexico1,
      1,
    );
    const insights = buildCollectionInsights(collection);

    expect(insights.selectionSummaries.map(({ section }) => section)).not.toContain(
      "PANINI",
    );
    expect(insights.selectionSummaries.map(({ section }) => section)).not.toContain(
      "FWC",
    );
    expect(insights.startedSelectionCount).toBe(1);
    expect(insights.totalDuplicateCopyCount).toBe(1);
    expect(insights.totalMissingCount).toBe(977);
    expect(insights.nextGlobalMilestone).toEqual({
      target: 10,
      current: 3,
      remaining: 7,
    });
  });

  it("keeps selection summaries in canonical order", () => {
    const insights = buildCollectionInsights(createEmptyCollection());

    expect(insights.selectionSummaries.slice(0, 6).map(({ section }) => section)).toEqual([
      "México",
      "Sudáfrica",
      "Corea del Sur",
      "Chequia",
      "Suiza",
      "Canadá",
    ]);
    expect(insights.selectionSummaries.at(-1)?.section).toBe("Panamá");
  });

  it("distinguishes repeated positions from repeated copies", () => {
    const collection = setCopies(
      setCopies(setCopies(createEmptyCollection(), mexico1, 4), mexico2, 2),
      argentina1,
      3,
    );
    const insights = buildCollectionInsights(collection);

    expect(getSelection(insights, "México").duplicateCopyCount).toBe(4);
    expect(getSelection(insights, "Argentina").duplicateCopyCount).toBe(2);
    expect(insights.totalDuplicateCopyCount).toBe(6);
  });

  it.each([
    [0, 10, 10],
    [9, 10, 1],
    [10, 25, 15],
    [24, 25, 1],
    [25, 50, 25],
    [49, 50, 1],
    [50, 100, 50],
    [99, 100, 1],
    [100, 200, 100],
    [199, 200, 1],
    [200, 350, 150],
    [349, 350, 1],
    [350, 500, 150],
    [499, 500, 1],
    [500, 650, 150],
    [649, 650, 1],
    [650, 800, 150],
    [799, 800, 1],
    [800, 900, 100],
    [899, 900, 1],
    [900, 950, 50],
    [949, 950, 1],
    [950, 980, 30],
    [979, 980, 1],
  ])(
    "uses the next global milestone above %i pegadas",
    (owned, target, remaining) => {
      const insights = buildCollectionInsights(collectionWithOwnedPositions(owned));

      expect(insights.nextGlobalMilestone).toEqual({
        target,
        current: owned,
        remaining,
      });
      expect(insights.nextGlobalMilestone?.target).toBeGreaterThan(owned);
    },
  );
});

function getSelection(
  insights: ReturnType<typeof buildCollectionInsights>,
  section: string,
) {
  const summary = insights.selectionSummaries.find(
    (selection) => selection.section === section,
  );

  if (!summary) {
    throw new Error(`No existe el resumen de ${section}.`);
  }

  return summary;
}

function withFirstPositions(
  collection: CollectionState,
  section: string,
  count: number,
): CollectionState {
  return Array.from({ length: count }, (_, index) => ({
    section,
    position: String(index + 1),
  })).reduce(
    (current, position) => setCopies(current, position, 1),
    collection,
  );
}

function collectionWithOwnedPositions(owned: number): CollectionState {
  return expandCanonicalAlbumPositions()
    .slice(0, owned)
    .reduce(
      (current, position) => setCopies(current, position, 1),
      createEmptyCollection(),
    );
}
