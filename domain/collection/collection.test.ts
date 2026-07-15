import { describe, expect, it } from "vitest";
import { expandCanonicalAlbumPositions } from "../album/canonical-album";
import {
  addCopy,
  CollectionDomainError,
  createEmptyCollection,
  getCopies,
  getDuplicateCopies,
  getDuplicateCopyCount,
  getGlobalProgress,
  getPhysicalCopyCount,
  getSectionProgress,
  getUniqueOwnedCount,
  isMissing,
  isOwned,
  listDuplicatePositions,
  listMissingPositions,
  makePositionKey,
  normalizeCollection,
  removeCopy,
  setCopies,
} from "./collection";

const panini = { section: "PANINI", position: "00" };
const mexico1 = { section: "México", position: "1" };
const mexico2 = { section: "México", position: "2" };
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
