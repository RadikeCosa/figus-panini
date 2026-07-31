import { describe, expect, it } from "vitest";
import {
  buildDuplicateCollectionView,
} from "./collection-views";
import {
  createEmptyCollection,
  setCopies,
  type CollectionState,
  type PositionRef,
} from "./collection";
import { formatDuplicateListMessage } from "./duplicate-list-message";

const panini = { section: "PANINI", position: "00" };
const fwc3 = { section: "FWC", position: "3" };
const fwc8 = { section: "FWC", position: "8" };
const mexico12 = { section: "México", position: "12" };
const argentina2 = { section: "Argentina", position: "2" };
const argentina7 = { section: "Argentina", position: "7" };
const argentina14 = { section: "Argentina", position: "14" };
const brasil5 = { section: "Brasil", position: "5" };
const panama20 = { section: "Panamá", position: "20" };

describe("duplicate list text message formatter", () => {
  it("formats an empty list as a friendly non-error message", () => {
    expect(formatDuplicateListMessage(buildDuplicateCollectionView(createEmptyCollection()))).toBe(
      "No tenemos figuritas repetidas para cambiar.",
    );
  });

  it("formats one section with available duplicate copies", () => {
    const view = buildDuplicateCollectionView(
      buildCollection([
        [argentina2, 2],
        [argentina7, 3],
        [argentina14, 4],
      ]),
    );

    expect(formatDuplicateListMessage(view)).toBe(
      [
        "Tengo estas figuritas repetidas para cambiar:",
        "",
        "Grupo J",
        "Argentina: 2, 7 (x2), 14 (x3)",
      ].join("\n"),
    );
  });

  it("formats several sections in canonical order with special sections first", () => {
    const view = buildDuplicateCollectionView(
      buildCollection([
        [panama20, 3],
        [argentina14, 2],
        [mexico12, 2],
        [fwc8, 2],
        [panini, 2],
        [fwc3, 3],
      ]),
    );
    const message = formatDuplicateListMessage(view);

    expect(message).toBe(
      [
        "Tengo estas figuritas repetidas para cambiar:",
        "",
        "PANINI: 00",
        "FWC: 3 (x2), 8",
        "",
        "Grupo A",
        "México: 12",
        "",
        "Grupo J",
        "Argentina: 14",
        "",
        "Grupo L",
        "Panamá: 20 (x2)",
      ].join("\n"),
    );
    expect(indexesInOrder(message, ["PANINI: 00", "FWC:", "Grupo A", "Grupo J", "Grupo L"])).toBe(
      true,
    );
  });

  it("keeps positions ordered inside each section", () => {
    const view = buildDuplicateCollectionView(
      buildCollection([
        [argentina14, 2],
        [argentina2, 2],
        [argentina7, 2],
      ]),
    );

    expect(formatDuplicateListMessage(view)).toContain("Argentina: 2, 7, 14");
  });

  it("uses quantity minus one and never shows x1", () => {
    const view = buildDuplicateCollectionView(
      buildCollection([
        [argentina2, 1],
        [argentina7, 2],
        [argentina14, 3],
        [brasil5, 4],
      ]),
    );
    const message = formatDuplicateListMessage(view);

    expect(message).toContain("Argentina: 7, 14 (x2)");
    expect(message).toContain("Brasil: 5 (x3)");
    expect(message).not.toContain("Argentina: 2");
    expect(message).not.toContain("(x1)");
  });

  it("is deterministic and does not mutate the received view", () => {
    const view = buildDuplicateCollectionView(
      buildCollection([
        [brasil5, 4],
        [argentina7, 3],
      ]),
    );
    const before = JSON.stringify(view);

    expect(formatDuplicateListMessage(view)).toBe(formatDuplicateListMessage(view));
    expect(JSON.stringify(view)).toBe(before);
  });
});

function buildCollection(
  entries: Array<[PositionRef, number]>,
): CollectionState {
  return entries.reduce(
    (collection, [position, copies]) => setCopies(collection, position, copies),
    createEmptyCollection(),
  );
}

function indexesInOrder(text: string, fragments: string[]): boolean {
  let previousIndex = -1;

  for (const fragment of fragments) {
    const index = text.indexOf(fragment);

    if (index <= previousIndex) {
      return false;
    }

    previousIndex = index;
  }

  return true;
}
