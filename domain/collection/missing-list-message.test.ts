import { describe, expect, it } from "vitest";
import { expandCanonicalAlbumPositions } from "../album/canonical-album";
import {
  createEmptyCollection,
  setCopies,
  type CollectionState,
  type PositionRef,
} from "./collection";
import { formatMissingListMessage } from "./missing-list-message";
import {
  buildMissingListDocument,
  type MissingListDocument,
} from "./missing-list-document";

const generatedAt = new Date("2026-07-30T12:34:56.789Z");

describe("missing list text message formatter", () => {
  it("formats a representative partial list with simple WhatsApp-friendly text", () => {
    const document: MissingListDocument = {
      generatedAt,
      totalCount: 980,
      ownedCount: 967,
      missingCount: 13,
      sections: [
        { section: "PANINI", group: null, positions: ["00"] },
        { section: "FWC", group: null, positions: ["2", "5", "7"] },
        { section: "México", group: "Grupo A", positions: ["1", "4", "8"] },
        { section: "Sudáfrica", group: "Grupo A", positions: ["3", "6"] },
        { section: "Países Bajos", group: "Grupo F", positions: ["10", "20"] },
        { section: "Túnez", group: "Grupo F", positions: ["11", "12"] },
      ],
    };

    expect(formatMissingListMessage(document)).toBe(
      [
        "Estas son las figuritas que nos faltan:",
        "",
        "PANINI: 00",
        "FWC: 2, 5, 7",
        "",
        "Grupo A",
        "México: 1, 4, 8",
        "Sudáfrica: 3, 6",
        "",
        "Grupo F",
        "Países Bajos: 10, 20",
        "Túnez: 11, 12",
      ].join("\n"),
    );
  });

  it("formats the empty collection with all 980 positions, groups A to L and canonical order", () => {
    const document = buildMissingListDocument(createEmptyCollection(), generatedAt);
    const message = formatMissingListMessage(document);

    expect(message.startsWith("Estas son las figuritas que nos faltan:\n\n")).toBe(
      true,
    );
    expect(message).toContain("PANINI: 00");
    expect(message).toContain(
      "FWC: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19",
    );
    expect(message).toContain("Grupo A\nMéxico: 1, 2, 3");
    expect(message).toContain("Grupo L\nInglaterra: 1, 2, 3");
    expect(message).toContain("Panamá: 1, 2, 3, 4");
    expect(message).not.toMatch(/1\s*[–-]\s*20/);
    expect(message).not.toContain("Coca-Cola");
    expect(indexesInOrder(message, ["PANINI: 00", "FWC:", "Grupo A", "Grupo L"])).toBe(
      true,
    );
  });

  it("keeps all individual numbers visible without ranges", () => {
    const document: MissingListDocument = {
      generatedAt,
      totalCount: 980,
      ownedCount: 960,
      missingCount: 20,
      sections: [
        {
          section: "Argentina",
          group: "Grupo J",
          positions: Array.from({ length: 20 }, (_, index) => String(index + 1)),
        },
      ],
    };

    expect(formatMissingListMessage(document)).toContain(
      "Argentina: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20",
    );
    expect(formatMissingListMessage(document)).not.toContain("1-20");
  });

  it("omits completed sections and keeps accented canonical names", () => {
    const ownedPositions = expandCanonicalAlbumPositions().filter(
      ({ section, position }) =>
        section !== "México" &&
        section !== "Túnez" &&
        !(section === "Curazao" && position === "15"),
    );
    const document = buildMissingListDocument(
      buildCollectionWithPositions(ownedPositions),
      generatedAt,
    );
    const message = formatMissingListMessage(document);

    expect(message).toContain("México: 1, 2, 3");
    expect(message).toContain("Túnez: 1, 2, 3");
    expect(message).toContain("Curazao: 15");
    expect(message).not.toContain("PANINI:");
    expect(message).not.toContain("FWC:");
    expect(message).not.toContain("Bélgica:");
  });

  it("formats a complete album as a friendly non-error message", () => {
    const document = buildMissingListDocument(
      buildCollectionWithPositions(expandCanonicalAlbumPositions()),
      generatedAt,
    );

    expect(formatMissingListMessage(document)).toBe(
      "¡Álbum completo! Ya tenemos las 980 figuritas.",
    );
  });

  it("does not mutate the received document", () => {
    const document = buildMissingListDocument(createEmptyCollection(), generatedAt);
    const before = JSON.stringify(document);

    formatMissingListMessage(document);

    expect(JSON.stringify(document)).toBe(before);
  });
});

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

function buildCollectionWithPositions(positions: PositionRef[]): CollectionState {
  return positions.reduce(
    (collection, position) => setCopies(collection, position, 1),
    createEmptyCollection(),
  );
}
