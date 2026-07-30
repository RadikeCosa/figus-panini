import { describe, expect, it } from "vitest";
import { expandCanonicalAlbumPositions } from "../album/canonical-album";
import {
  createEmptyCollection,
  makePositionKey,
  setCopies,
  type CollectionState,
  type PositionRef,
} from "./collection";
import { buildMissingListDocument } from "./missing-list-document";

const generatedAt = new Date("2026-07-30T12:34:56.789Z");
const panini = { section: "PANINI", position: "00" };
const fwc1 = { section: "FWC", position: "1" };
const fwc19 = { section: "FWC", position: "19" };
const mexico1 = { section: "México", position: "1" };
const mexico2 = { section: "México", position: "2" };
const mexico20 = { section: "México", position: "20" };
const sudafrica1 = { section: "Sudáfrica", position: "1" };

describe("missing list document projection", () => {
  it("builds a complete missing document for an empty collection", () => {
    const document = buildMissingListDocument(createEmptyCollection(), generatedAt);

    expect(document.totalCount).toBe(980);
    expect(document.ownedCount).toBe(0);
    expect(document.missingCount).toBe(980);
    expect(document.sections).toHaveLength(50);
    expect(document.sections[0]).toEqual({
      section: "PANINI",
      group: null,
      positions: ["00"],
    });
    expect(document.sections[1]).toEqual({
      section: "FWC",
      group: null,
      positions: Array.from({ length: 19 }, (_, index) => String(index + 1)),
    });
  });

  it("omits owned positions and keeps coherent totals for a partial collection", () => {
    const collection = setCopies(
      setCopies(setCopies(createEmptyCollection(), panini, 1), mexico1, 1),
      fwc19,
      1,
    );
    const document = buildMissingListDocument(collection, generatedAt);

    expect(document).toMatchObject({
      totalCount: 980,
      ownedCount: 3,
      missingCount: 977,
    });
    expect(document.sections.find(({ section }) => section === "PANINI")).toBe(
      undefined,
    );
    expect(document.sections.find(({ section }) => section === "FWC")?.positions).toEqual(
      Array.from({ length: 18 }, (_, index) => String(index + 1)),
    );
    expect(
      document.sections.find(({ section }) => section === "México")?.positions,
    ).toEqual(Array.from({ length: 19 }, (_, index) => String(index + 2)));
  });

  it("returns an empty section list for a complete album", () => {
    const collection = buildCollectionWithAllPositions();
    const document = buildMissingListDocument(collection, generatedAt);

    expect(document.totalCount).toBe(980);
    expect(document.ownedCount).toBe(980);
    expect(document.missingCount).toBe(0);
    expect(document.sections).toEqual([]);
  });

  it("counts repeated copies as one owned position", () => {
    const collection = setCopies(createEmptyCollection(), mexico1, 4);
    const document = buildMissingListDocument(collection, generatedAt);

    expect(document.ownedCount).toBe(1);
    expect(document.missingCount).toBe(979);
    expect(document.sections.find(({ section }) => section === "México")?.positions).toEqual(
      Array.from({ length: 19 }, (_, index) => String(index + 2)),
    );
  });

  it("keeps sections in canonical order", () => {
    const collection = setCopies(setCopies(createEmptyCollection(), panini, 1), fwc1, 1);
    const document = buildMissingListDocument(collection, generatedAt);

    expect(document.sections.slice(0, 5).map(({ section }) => section)).toEqual([
      "FWC",
      "México",
      "Sudáfrica",
      "Corea del Sur",
      "Chequia",
    ]);
    expect(document.sections.at(-1)?.section).toBe("Panamá");
  });

  it("keeps positions in canonical order inside each section", () => {
    const collection = setCopies(createEmptyCollection(), mexico2, 1);
    const mexicoSection = buildMissingListDocument(collection, generatedAt).sections.find(
      ({ section }) => section === "México",
    );

    expect(mexicoSection?.positions).toEqual([
      "1",
      ...Array.from({ length: 18 }, (_, index) => String(index + 3)),
    ]);
  });

  it("omits completed sections completely", () => {
    const collection = buildCollectionWithPositions([panini, fwc1, fwc19]);
    const document = buildMissingListDocument(collection, generatedAt);

    expect(document.sections.some(({ section }) => section === "PANINI")).toBe(false);
    expect(document.sections.find(({ section }) => section === "FWC")?.positions).toEqual(
      Array.from({ length: 17 }, (_, index) => String(index + 2)),
    );
  });

  it("preserves canonical names with accents and selection groups", () => {
    const collection = setCopies(
      setCopies(createEmptyCollection(), mexico1, 1),
      sudafrica1,
      1,
    );
    const document = buildMissingListDocument(collection, generatedAt);

    expect(document.sections.find(({ section }) => section === "México")).toEqual({
      section: "México",
      group: "Grupo A",
      positions: Array.from({ length: 19 }, (_, index) => String(index + 2)),
    });
    expect(document.sections.find(({ section }) => section === "Sudáfrica")).toEqual({
      section: "Sudáfrica",
      group: "Grupo A",
      positions: Array.from({ length: 19 }, (_, index) => String(index + 2)),
    });
  });

  it("never includes promotional sections", () => {
    const document = buildMissingListDocument(createEmptyCollection(), generatedAt);

    expect(document.sections.map(({ section }) => section)).not.toContain("Coca-Cola");
  });

  it("keeps exactly the received generated date", () => {
    const document = buildMissingListDocument(createEmptyCollection(), generatedAt);

    expect(document.generatedAt).toBe(generatedAt);
  });

  it("does not mutate the received collection", () => {
    const collection = setCopies(createEmptyCollection(), mexico20, 2);
    const before = JSON.stringify(collection);

    buildMissingListDocument(collection, generatedAt);

    expect(JSON.stringify(collection)).toBe(before);
    expect(collection.copiesByPosition[makePositionKey(mexico20)]).toBe(2);
  });

  it("omits a selection section when all its positions are owned", () => {
    const mexicoPositions = expandCanonicalAlbumPositions().filter(
      ({ section }) => section === "México",
    );
    const collection = buildCollectionWithPositions(mexicoPositions);
    const document = buildMissingListDocument(collection, generatedAt);

    expect(document.sections.some(({ section }) => section === "México")).toBe(false);
    expect(document.sections.find(({ section }) => section === "Sudáfrica")?.section).toBe(
      "Sudáfrica",
    );
  });
});

function buildCollectionWithAllPositions(): CollectionState {
  return buildCollectionWithPositions(expandCanonicalAlbumPositions());
}

function buildCollectionWithPositions(positions: PositionRef[]): CollectionState {
  return positions.reduce(
    (collection, position) => setCopies(collection, position, 1),
    createEmptyCollection(),
  );
}
