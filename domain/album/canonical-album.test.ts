import { describe, expect, it } from "vitest";
import {
  expandCanonicalAlbumPositions,
  SELECTION_GROUPS,
  SELECTION_SECTIONS,
} from "./canonical-album";

const positions = expandCanonicalAlbumPositions();
const identityOf = (position: { section: string; position: string }) =>
  `${position.section}-${position.position}`;

const EXPECTED_SELECTIONS = [
  "México",
  "Sudáfrica",
  "Corea del Sur",
  "Chequia",
  "Suiza",
  "Canadá",
  "Bosnia",
  "Qatar",
  "Brasil",
  "Marruecos",
  "Escocia",
  "Haití",
  "Estados Unidos",
  "Australia",
  "Paraguay",
  "Turquía",
  "Alemania",
  "Costa de Marfil",
  "Ecuador",
  "Curazao",
  "Países Bajos",
  "Japón",
  "Suecia",
  "Túnez",
  "Bélgica",
  "Egipto",
  "Irán",
  "Nueva Zelanda",
  "España",
  "Cabo Verde",
  "Uruguay",
  "Arabia Saudita",
  "Francia",
  "Noruega",
  "Senegal",
  "Irak",
  "Argentina",
  "Austria",
  "Argelia",
  "Jordania",
  "Colombia",
  "Portugal",
  "República Democrática del Congo",
  "Uzbekistán",
  "Inglaterra",
  "Croacia",
  "Ghana",
  "Panamá",
];

describe("canonical album definition", () => {
  it("expands to exactly 980 positions", () => {
    expect(positions).toHaveLength(980);
  });

  it("defines 48 selections in 12 groups of 4", () => {
    expect(SELECTION_GROUPS).toHaveLength(12);
    expect(SELECTION_GROUPS.every(({ sections }) => sections.length === 4)).toBe(
      true,
    );
    expect(SELECTION_SECTIONS).toHaveLength(48);
  });

  it("keeps the confirmed selection order", () => {
    expect(SELECTION_SECTIONS).toEqual(EXPECTED_SELECTIONS);
  });

  it("does not repeat selection names", () => {
    expect(new Set(SELECTION_SECTIONS).size).toBe(SELECTION_SECTIONS.length);
  });

  it("defines 20 positions for every selection without gaps", () => {
    for (const section of SELECTION_SECTIONS) {
      const sectionPositions = positions
        .filter((position) => position.section === section)
        .map((position) => position.position);

      expect(sectionPositions).toEqual(
        Array.from({ length: 20 }, (_, index) => String(index + 1)),
      );
    }
  });

  it("defines one PANINI-00 position", () => {
    expect(positions.filter((position) => position.section === "PANINI")).toEqual(
      [{ section: "PANINI", position: "00", globalOrder: 1 }],
    );
  });

  it("defines 19 FWC positions without gaps", () => {
    const fwcPositions = positions
      .filter((position) => position.section === "FWC")
      .map((position) => position.position);

    expect(fwcPositions).toEqual(
      Array.from({ length: 19 }, (_, index) => String(index + 1)),
    );
  });

  it("does not duplicate identities", () => {
    const identities = positions.map(identityOf);

    expect(new Set(identities).size).toBe(positions.length);
  });

  it("keeps global order unique and consecutive", () => {
    expect(positions.map((position) => position.globalOrder)).toEqual(
      Array.from({ length: 980 }, (_, index) => index + 1),
    );
  });

  it("keeps the required global boundaries", () => {
    expect(identityOf(positions[0])).toBe("PANINI-00");
    expect(identityOf(positions[1])).toBe("FWC-1");
    expect(identityOf(positions[19])).toBe("FWC-19");
    expect(identityOf(positions[20])).toBe("México-1");
    expect(identityOf(positions[979])).toBe("Panamá-20");
  });

  it("excludes promotional sections", () => {
    const sections = new Set(positions.map((position) => position.section));

    expect(sections.has("Coca-Cola")).toBe(false);
    expect(sections.has("CC")).toBe(false);
  });
});
