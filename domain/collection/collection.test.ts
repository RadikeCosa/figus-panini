import { describe, expect, it } from "vitest";
import { expandCanonicalAlbumPositions } from "../album/canonical-album";
import {
  addCopy,
  CollectionDomainError,
  buildSectionSuggestionValue,
  createEmptyCollection,
  getCanonicalSectionSuggestions,
  getCopies,
  getDuplicateCopies,
  getDuplicateCopyCount,
  getGlobalProgress,
  getPhysicalCopyCount,
  getPositionCollectionStatus,
  getSectionProgress,
  getUniqueOwnedCount,
  isMissing,
  isOwned,
  listDuplicatePositions,
  listMissingPositions,
  makePositionKey,
  normalizeSectionText,
  normalizeCollection,
  parsePositionQuery,
  parseSectionSuggestionQuery,
  removeCopy,
  resolveCanonicalSection,
  setCopies,
  validatePositionExists,
} from "./collection";

const panini = { section: "PANINI", position: "00" };
const fwc1 = { section: "FWC", position: "1" };
const fwc19 = { section: "FWC", position: "19" };
const argentina1 = { section: "Argentina", position: "1" };
const argentina7 = { section: "Argentina", position: "7" };
const argentina20 = { section: "Argentina", position: "20" };
const mexico1 = { section: "México", position: "1" };
const mexico2 = { section: "México", position: "2" };
const mexico12 = { section: "México", position: "12" };
const mexico20 = { section: "México", position: "20" };
const panama20 = { section: "Panamá", position: "20" };
const unknownPosition = { section: "Coca-Cola", position: "1" };

describe("collection domain", () => {
  it("represents an empty collection without zero entries", () => {
    const collection = createEmptyCollection();

    expect(collection.copiesByPosition).toEqual({});
    expect(getCopies(collection, mexico1)).toBe(0);
  });

  it("adds the first copy", () => {
    const collection = addCopy(createEmptyCollection(), mexico1);

    expect(getCopies(collection, mexico1)).toBe(1);
  });

  it("adds several copies", () => {
    const collection = addCopy(addCopy(addCopy(createEmptyCollection(), mexico1), mexico1), mexico1);

    expect(getCopies(collection, mexico1)).toBe(3);
  });

  it("removes one copy", () => {
    const collection = removeCopy(setCopies(createEmptyCollection(), mexico1, 3), mexico1);

    expect(getCopies(collection, mexico1)).toBe(2);
  });

  it("removes the last copy from stored state", () => {
    const collection = removeCopy(setCopies(createEmptyCollection(), mexico1, 1), mexico1);

    expect(getCopies(collection, mexico1)).toBe(0);
    expect(collection.copiesByPosition).toEqual({});
  });

  it("does not remove below zero", () => {
    const collection = removeCopy(createEmptyCollection(), mexico1);

    expect(getCopies(collection, mexico1)).toBe(0);
    expect(collection.copiesByPosition).toEqual({});
  });

  it("does not mutate received collections", () => {
    const initial = setCopies(createEmptyCollection(), mexico1, 1);
    const updated = addCopy(initial, mexico1);

    expect(getCopies(initial, mexico1)).toBe(1);
    expect(getCopies(updated, mexico1)).toBe(2);
    expect(updated).not.toBe(initial);
    expect(updated.copiesByPosition).not.toBe(initial.copiesByPosition);
  });

  it("rejects unknown positions in modifying operations", () => {
    expect(() => addCopy(createEmptyCollection(), unknownPosition)).toThrow(
      CollectionDomainError,
    );
    expect(() => setCopies(createEmptyCollection(), unknownPosition, 1)).toThrow(
      "no existe en el álbum",
    );
  });

  it("rejects invalid explicit quantities", () => {
    expect(() => setCopies(createEmptyCollection(), mexico1, -1)).toThrow(
      CollectionDomainError,
    );
    expect(() => setCopies(createEmptyCollection(), mexico1, 1.5)).toThrow(
      CollectionDomainError,
    );
  });

  it("calculates missing, owned and duplicate copies", () => {
    const collection = setCopies(createEmptyCollection(), mexico1, 3);

    expect(isOwned(collection, mexico1)).toBe(true);
    expect(isMissing(collection, mexico1)).toBe(false);
    expect(getDuplicateCopies(collection, mexico1)).toBe(2);
    expect(isOwned(collection, mexico2)).toBe(false);
    expect(isMissing(collection, mexico2)).toBe(true);
    expect(getDuplicateCopies(collection, mexico2)).toBe(0);
  });

  it("calculates empty progress as 0 / 980", () => {
    expect(getGlobalProgress(createEmptyCollection())).toEqual({
      owned: 0,
      total: 980,
    });
  });

  it("calculates full progress as 980 / 980", () => {
    const collection = expandCanonicalAlbumPositions().reduce(
      (current, position) => setCopies(current, position, 1),
      createEmptyCollection(),
    );

    expect(getGlobalProgress(collection)).toEqual({ owned: 980, total: 980 });
  });

  it("calculates section progress", () => {
    const collection = setCopies(
      setCopies(createEmptyCollection(), mexico1, 1),
      mexico20,
      2,
    );

    expect(getSectionProgress(collection, "México")).toEqual({
      section: "México",
      owned: 2,
      total: 20,
    });
  });

  it("calculates physical, unique and duplicate totals", () => {
    const collection = setCopies(
      setCopies(createEmptyCollection(), mexico1, 11),
      panini,
      1,
    );

    expect(getPhysicalCopyCount(collection)).toBe(12);
    expect(getUniqueOwnedCount(collection)).toBe(2);
    expect(getDuplicateCopyCount(collection)).toBe(10);
  });

  it("lists missing positions in canonical order", () => {
    const collection = setCopies(
      setCopies(createEmptyCollection(), panini, 1),
      mexico1,
      1,
    );
    const missing = listMissingPositions(collection);

    expect(missing).toHaveLength(978);
    expect(missing.slice(0, 3).map(({ section, position }) => `${section}-${position}`)).toEqual([
      "FWC-1",
      "FWC-2",
      "FWC-3",
    ]);
    expect(`${missing.at(-1)?.section}-${missing.at(-1)?.position}`).toBe(
      "Panamá-20",
    );
  });

  it("lists duplicate positions in canonical order", () => {
    const collection = setCopies(
      setCopies(setCopies(createEmptyCollection(), panama20, 3), panini, 2),
      mexico1,
      4,
    );

    expect(listDuplicatePositions(collection).map(({ section, position }) => `${section}-${position}`)).toEqual([
      "PANINI-00",
      "México-1",
      "Panamá-20",
    ]);
  });

  it("normalizes zero quantities by omitting them", () => {
    const result = normalizeCollection({
      [makePositionKey(mexico1)]: 0,
      [makePositionKey(mexico2)]: 2,
    });

    expect(result.issues).toEqual([]);
    expect(getCopies(result.collection, mexico1)).toBe(0);
    expect(getCopies(result.collection, mexico2)).toBe(2);
    expect(Object.keys(result.collection.copiesByPosition)).toEqual([
      makePositionKey(mexico2),
    ]);
  });

  it("reports invalid quantities from external data", () => {
    const result = normalizeCollection({
      [makePositionKey(mexico1)]: "2",
      [makePositionKey(mexico2)]: -1,
      [makePositionKey(mexico20)]: 1.5,
    });

    expect(result.collection).toEqual(createEmptyCollection());
    expect(result.issues.map((issue) => issue.type)).toEqual([
      "invalid-quantity",
      "invalid-quantity",
      "invalid-quantity",
    ]);
  });

  it("reports and excludes unknown external positions", () => {
    const result = normalizeCollection({
      [makePositionKey(mexico1)]: 1,
      [makePositionKey(unknownPosition)]: 4,
    });

    expect(getCopies(result.collection, mexico1)).toBe(1);
    expect(result.issues).toEqual([
      {
        type: "unknown-position",
        key: makePositionKey(unknownPosition),
        position: unknownPosition,
      },
    ]);
  });

  it("reports duplicate positions from external entry arrays", () => {
    const result = normalizeCollection([
      { section: "México", position: "1", copies: 2 },
      { section: "México", position: "1", copies: 3 },
    ]);

    expect(getCopies(result.collection, mexico1)).toBe(2);
    expect(result.issues).toEqual([
      {
        type: "duplicate-position",
        key: makePositionKey(mexico1),
        position: mexico1,
      },
    ]);
  });
});

describe("section suggestions domain", () => {
  it("returns suggestions by prefix", () => {
    expect(getCanonicalSectionSuggestions("arg").map(({ section }) => section)).toEqual([
      "Argentina",
      "Argelia",
    ]);
  });

  it("matches suggestions without accents", () => {
    expect(getCanonicalSectionSuggestions("mexico")).toEqual([
      { section: "México", value: "México " },
    ]);
  });

  it("matches suggestions ignoring case", () => {
    expect(getCanonicalSectionSuggestions("PAN").at(0)).toEqual({
      section: "PANINI",
      value: "PANINI ",
    });
  });

  it("uses content matches when prefix matches do not fill the limit", () => {
    expect(getCanonicalSectionSuggestions("sur").map(({ section }) => section)).toEqual([
      "Corea del Sur",
    ]);
  });

  it("limits the amount of suggestions", () => {
    expect(getCanonicalSectionSuggestions("a", 5)).toHaveLength(5);
  });

  it("suggests PANINI and FWC from the canonical sections", () => {
    expect(getCanonicalSectionSuggestions("pani")).toEqual([
      { section: "PANINI", value: "PANINI " },
    ]);
    expect(getCanonicalSectionSuggestions("fw")).toEqual([
      { section: "FWC", value: "FWC " },
    ]);
  });

  it("keeps an already typed position when building a suggestion", () => {
    expect(parseSectionSuggestionQuery("core 18")).toEqual({
      sectionInput: "core",
      positionInput: "18",
    });
    expect(getCanonicalSectionSuggestions("core 18")).toEqual([
      { section: "Corea del Sur", value: "Corea del Sur 18" },
    ]);
  });

  it("handles multi-word section fragments", () => {
    expect(parseSectionSuggestionQuery("corea del sur 18")).toEqual({
      sectionInput: "corea del sur",
      positionInput: "18",
    });
  });

  it("returns no suggestions for empty queries", () => {
    expect(getCanonicalSectionSuggestions("   ")).toEqual([]);
  });

  it("returns no suggestions when the query is already a valid position", () => {
    expect(getCanonicalSectionSuggestions("Corea del Sur 18")).toEqual([]);
  });

  it("builds a value with trailing space when there is no position", () => {
    expect(
      buildSectionSuggestionValue({ sectionInput: "arg", positionInput: null }, "Argentina"),
    ).toBe("Argentina ");
  });
});

describe("position query domain", () => {
  it("normalizes section text for accents, case and spaces", () => {
    expect(normalizeSectionText("  MÉXICO   ")).toBe("mexico");
    expect(normalizeSectionText("Corea   del Sur")).toBe("corea del sur");
  });

  it("resolves exact section names and returns the canonical identity", () => {
    expect(resolveCanonicalSection("Argentina")).toEqual({
      status: "found",
      section: "Argentina",
    });
  });

  it("resolves section names with different case", () => {
    expect(resolveCanonicalSection("mexico")).toEqual({
      status: "found",
      section: "México",
    });
  });

  it("resolves section names without accents", () => {
    expect(resolveCanonicalSection("Mexico")).toEqual({
      status: "found",
      section: "México",
    });
  });

  it("resolves multi-word section names with extra spaces", () => {
    expect(resolveCanonicalSection("  Corea   del Sur ")).toEqual({
      status: "found",
      section: "Corea del Sur",
    });
  });

  it("parses PANINI 00", () => {
    expect(parsePositionQuery("PANINI 00", createEmptyCollection())).toMatchObject({
      status: "found",
      position: panini,
      copies: 0,
      duplicateCopies: 0,
      ownership: "missing",
    });
  });

  it("parses FWC 1 and FWC 19", () => {
    expect(parsePositionQuery("FWC 1", createEmptyCollection())).toMatchObject({
      status: "found",
      position: fwc1,
    });
    expect(parsePositionQuery("FWC 19", createEmptyCollection())).toMatchObject({
      status: "found",
      position: fwc19,
    });
  });

  it("parses country positions 1 and 20", () => {
    expect(parsePositionQuery("Argentina 1", createEmptyCollection())).toMatchObject({
      status: "found",
      position: argentina1,
    });
    expect(parsePositionQuery("Argentina 20", createEmptyCollection())).toMatchObject({
      status: "found",
      position: argentina20,
    });
  });

  it("keeps the canonical section when parsing a query", () => {
    expect(parsePositionQuery("mexico 12", createEmptyCollection())).toMatchObject({
      status: "found",
      position: mexico12,
    });
  });

  it("reports unknown sections", () => {
    expect(parsePositionQuery("Italia 7", createEmptyCollection())).toEqual({
      status: "section-not-found",
      sectionInput: "Italia",
    });
  });

  it("reports a missing number", () => {
    expect(parsePositionQuery("Argentina", createEmptyCollection())).toEqual({
      status: "missing-position-number",
      sectionInput: "Argentina",
    });
  });

  it("reports a non numeric number", () => {
    expect(parsePositionQuery("Argentina siete", createEmptyCollection())).toEqual({
      status: "non-numeric-position",
      sectionInput: "Argentina",
      positionInput: "siete",
    });
  });

  it("reports country numbers out of range", () => {
    expect(parsePositionQuery("Argentina 21", createEmptyCollection())).toEqual({
      status: "position-out-of-range",
      section: "Argentina",
      positionInput: "21",
      allowedPositions: Array.from({ length: 20 }, (_, index) => String(index + 1)),
    });
  });

  it("reports PANINI 1 as invalid", () => {
    expect(parsePositionQuery("PANINI 1", createEmptyCollection())).toEqual({
      status: "position-out-of-range",
      section: "PANINI",
      positionInput: "1",
      allowedPositions: ["00"],
    });
  });

  it("reports FWC 20 as invalid", () => {
    expect(parsePositionQuery("FWC 20", createEmptyCollection())).toEqual({
      status: "position-out-of-range",
      section: "FWC",
      positionInput: "20",
      allowedPositions: Array.from({ length: 19 }, (_, index) => String(index + 1)),
    });
  });

  it("validates that a position exists", () => {
    expect(validatePositionExists("FWC", "4")).toEqual({
      valid: true,
      position: { section: "FWC", position: "4" },
    });
    expect(validatePositionExists("PANINI", "1")).toEqual({
      valid: false,
      allowedPositions: ["00"],
    });
  });

  it("returns collection status with zero copies", () => {
    expect(getPositionCollectionStatus(createEmptyCollection(), argentina7)).toEqual({
      status: "found",
      position: argentina7,
      copies: 0,
      duplicateCopies: 0,
      ownership: "missing",
    });
  });

  it("returns collection status with one copy", () => {
    const collection = setCopies(createEmptyCollection(), argentina7, 1);

    expect(getPositionCollectionStatus(collection, argentina7)).toEqual({
      status: "found",
      position: argentina7,
      copies: 1,
      duplicateCopies: 0,
      ownership: "owned",
    });
  });

  it("returns collection status with several copies and duplicates", () => {
    const collection = setCopies(createEmptyCollection(), argentina7, 3);

    expect(getPositionCollectionStatus(collection, argentina7)).toEqual({
      status: "found",
      position: argentina7,
      copies: 3,
      duplicateCopies: 2,
      ownership: "duplicate",
    });
  });
});
