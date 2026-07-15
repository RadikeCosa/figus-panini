import { describe, expect, it } from "vitest";
import { expandCanonicalAlbumPositions } from "../album/canonical-album";
import { createEmptyCollection, setCopies } from "./collection";
import {
  buildAlbumSectionHref,
  buildDuplicateCollectionView,
  buildMissingCollectionView,
  listCollectionSectionOptions,
} from "./collection-views";

const panini = { section: "PANINI", position: "00" };
const mexico1 = { section: "México", position: "1" };
const mexico2 = { section: "México", position: "2" };
const argentina7 = { section: "Argentina", position: "7" };
const panama20 = { section: "Panamá", position: "20" };

describe("collection views", () => {
  it("lists section options in canonical order", () => {
    const options = listCollectionSectionOptions();

    expect(options.slice(0, 6).map(({ section }) => section)).toEqual([
      "PANINI",
      "FWC",
      "México",
      "Sudáfrica",
      "Corea del Sur",
      "Chequia",
    ]);
    expect(options.at(-1)?.section).toBe("Panamá");
  });

  it("summarizes missing positions by section in canonical order", () => {
    const collection = setCopies(
      setCopies(createEmptyCollection(), panini, 1),
      mexico1,
      1,
    );
    const view = buildMissingCollectionView(collection);

    expect(view.totalMissing).toBe(978);
    expect(view.progress).toEqual({ owned: 2, total: 980 });
    expect(view.sections.slice(0, 2).map(({ section, missing }) => [section, missing])).toEqual([
      ["FWC", 19],
      ["México", 19],
    ]);
    expect(view.sections.at(-1)?.section).toBe("Panamá");
  });

  it("returns no missing sections for a complete collection", () => {
    const collection = expandCanonicalAlbumPositions().reduce(
      (current, position) => setCopies(current, position, 1),
      createEmptyCollection(),
    );

    expect(buildMissingCollectionView(collection)).toMatchObject({
      totalMissing: 0,
      sections: [],
    });
  });

  it("distinguishes duplicate positions from duplicate copies", () => {
    const collection = setCopies(
      setCopies(setCopies(createEmptyCollection(), mexico2, 4), argentina7, 2),
      panama20,
      3,
    );
    const view = buildDuplicateCollectionView(collection);

    expect(view.duplicatePositionCount).toBe(3);
    expect(view.duplicateCopyCount).toBe(6);
    expect(view.sections.map(({ section }) => section)).toEqual([
      "México",
      "Argentina",
      "Panamá",
    ]);
    expect(view.sections[0].positions[0]).toMatchObject({
      section: "México",
      position: "2",
      copies: 4,
      duplicateCopies: 3,
    });
  });

  it("builds encoded album section links", () => {
    expect(buildAlbumSectionHref("Corea del Sur")).toBe(
      "/album?section=Corea%20del%20Sur",
    );
    expect(buildAlbumSectionHref("México")).toBe("/album?section=M%C3%A9xico");
  });
});
