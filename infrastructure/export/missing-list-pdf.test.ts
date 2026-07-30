import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  expandCanonicalAlbumPositions,
  SELECTION_GROUPS,
  SELECTION_SECTIONS,
} from "../../domain/album/canonical-album";
import {
  createEmptyCollection,
  setCopies,
  type CollectionState,
  type PositionRef,
} from "../../domain/collection/collection";
import {
  buildMissingListDocument,
  type MissingListDocument,
} from "../../domain/collection/missing-list-document";
import {
  __missingListPdfTestUtils,
  createMissingListPdf,
  MIN_READABLE_FONT_SIZE,
  type MissingListPdfLayoutPlan,
} from "./missing-list-pdf";

const generatedAt = new Date("2026-07-30T15:20:10.000Z");

describe("missing list PDF generator", () => {
  it("returns a PDF Blob with a predictable filename", async () => {
    const result = await createMissingListPdf(
      buildMissingListDocument(createEmptyCollection(), generatedAt),
    );

    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.blob.type).toBe("application/pdf");
    expect(result.filename).toBe("figuritas-faltantes-2026-07-30.pdf");
    await expectPdf(result.blob, { pages: 1, pageSize: "a4-portrait" });
  });

  it("formats the report timestamp with date and time", () => {
    expect(__missingListPdfTestUtils.formatDisplayDate(generatedAt)).toBe(
      "30/07/2026, 15:20",
    );
  });

  it("does not mutate the received document", async () => {
    const document = buildMissingListDocument(createEmptyCollection(), generatedAt);
    const before = snapshotDocument(document);

    await createMissingListPdf(document);

    expect(snapshotDocument(document)).toEqual(before);
  });

  it("generates a concise PDF for a complete album", async () => {
    const result = await createMissingListPdf(
      buildMissingListDocument(buildCollectionWithAllPositions(), generatedAt),
    );

    expect(result.blob.size).toBeGreaterThan(900);
    await expectPdf(result.blob, { pages: 1 });
  });

  it("generates a PDF for a few missing positions", async () => {
    const ownedPositions = expandCanonicalAlbumPositions().filter(
      (position) =>
        ![
          "México-1",
          "México-4",
          "Países Bajos-3",
          "Túnez-8",
          "Bélgica-9",
          "España-12",
          "Curazao-15",
          "Corea del Sur-18",
          "Costa de Marfil-20",
        ].includes(`${position.section}-${position.position}`),
    );
    const document = buildMissingListDocument(
      buildCollectionWithPositions(ownedPositions),
      generatedAt,
    );
    const result = await createMissingListPdf(document);

    expect(document.missingCount).toBe(9);
    expect(result.blob.size).toBeGreaterThan(1_000);
    await expectPdf(result.blob, { pages: 1 });
  });

  it("generates a one-page portrait A4 PDF for the empty collection with 980 missing positions", async () => {
    const document = buildMissingListDocument(createEmptyCollection(), generatedAt);
    const plan = __missingListPdfTestUtils.planMissingListPdfLayout(document);
    const result = await createMissingListPdf(
      document,
    );

    expect(plan.config.orientation).toBe("portrait");
    expect(plan.config.columns).toBe(3);
    expect(plan.config.numberSize).toBeGreaterThanOrEqual(MIN_READABLE_FONT_SIZE);
    expect(plan.pages).toHaveLength(1);
    expect(result.blob.size).toBeGreaterThan(3_000);
    await expectPdf(result.blob, { pages: 1, pageSize: "a4-portrait" });
    expectPlanContentWithinMargins(plan);
  });

  it("keeps every position explicit without ranges in complete sections", () => {
    const document = buildMissingListDocument(createEmptyCollection(), generatedAt);
    const plan = __missingListPdfTestUtils.planMissingListPdfLayout(document);
    const sections = flattenPlanSections(plan);
    const argentina = sections.find((section) => section.section === "Argentina");
    const fwc = sections.find((section) => section.section === "FWC");

    expect(sections[0]).toMatchObject({
      section: "PANINI · 00",
      positions: ["00"],
    });
    expect(fwc?.positions).toEqual(
      Array.from({ length: 19 }, (_, index) => String(index + 1)),
    );
    expect(argentina?.numberLines.flat()).toEqual(
      Array.from({ length: 20 }, (_, index) => String(index + 1)),
    );
    expect(argentina?.numberLines.map((line) => line.join(" "))).toEqual([
      "1 2 3 4 5 6 7 8 9 10",
      "11 12 13 14 15 16 17 18 19 20",
    ]);
    expect(flattenPlanText(plan)).not.toMatch(/1\s*[–-]\s*20/);
  });

  it("preserves canonical reading order, all groups and all 48 selections", () => {
    const document = buildMissingListDocument(createEmptyCollection(), generatedAt);
    const plan = __missingListPdfTestUtils.planMissingListPdfLayout(document);
    const sections = flattenPlanSections(plan);
    const selectionSections = sections
      .filter(({ section }) => section !== "PANINI · 00" && section !== "FWC")
      .map(({ section }) => section);
    const groups = sections
      .map(({ group }) => group)
      .filter((group): group is string => group !== null);

    expect(sections.map(({ section }) => section).slice(0, 2)).toEqual([
      "PANINI · 00",
      "FWC",
    ]);
    expect(selectionSections).toEqual(SELECTION_SECTIONS);
    expect(new Set(selectionSections).size).toBe(48);
    expect(groups).toEqual(SELECTION_GROUPS.map(({ group }) => group));
  });

  it("does not leave group headers isolated from their first section", () => {
    const document = buildMissingListDocument(createEmptyCollection(), generatedAt);
    const plan = __missingListPdfTestUtils.planMissingListPdfLayout(document);

    for (const section of flattenPlanSections(plan)) {
      if (section.group) {
        expect(section.positions.length).toBeGreaterThan(0);
        expect(section.numberLines.flat()).toEqual(section.positions);
      }
    }
  });

  it("uses a compact single-column layout for short partial lists", () => {
    const ownedPositions = expandCanonicalAlbumPositions().filter(
      (position) =>
        ![
          "México-1",
          "México-4",
          "Países Bajos-3",
          "Túnez-8",
          "Bélgica-9",
        ].includes(`${position.section}-${position.position}`),
    );
    const document = buildMissingListDocument(
      buildCollectionWithPositions(ownedPositions),
      generatedAt,
    );
    const plan = __missingListPdfTestUtils.planMissingListPdfLayout(document);

    expect(document.missingCount).toBe(5);
    expect(plan.config.columns).toBe(1);
    expect(plan.pages).toHaveLength(1);
    expect(flattenPlanSections(plan).map(({ section }) => section)).toEqual([
      "México",
      "Países Bajos",
      "Túnez",
      "Bélgica",
    ]);
  });

  it("falls back to multipage layout before going below the readable font size", () => {
    const document = buildRepeatedMissingDocument(60);
    const plan = __missingListPdfTestUtils.planMissingListPdfLayout(document);

    expect(plan.pages.length).toBeGreaterThan(1);
    expect(plan.config.numberSize).toBeGreaterThanOrEqual(MIN_READABLE_FONT_SIZE);
    expectPlanContentWithinMargins(plan);
  });

  it("accepts the main visible text and accented section names in the document", async () => {
    const document: MissingListDocument = {
      generatedAt,
      totalCount: 980,
      ownedCount: 972,
      missingCount: 8,
      sections: [
        { section: "México", group: "Grupo A", positions: ["1"] },
        { section: "Países Bajos", group: "Grupo F", positions: ["2"] },
        { section: "Túnez", group: "Grupo F", positions: ["3"] },
        { section: "Bélgica", group: "Grupo G", positions: ["4"] },
        { section: "España", group: "Grupo H", positions: ["5"] },
        { section: "Curazao", group: "Grupo E", positions: ["6"] },
        { section: "Corea del Sur", group: "Grupo A", positions: ["7"] },
        { section: "Costa de Marfil", group: "Grupo E", positions: ["8"] },
      ],
    };

    const result = await createMissingListPdf(document);

    expect(result.blob.size).toBeGreaterThan(1_000);
    await expectPdf(result.blob, { pages: 1, pageSize: "a4-portrait" });
  });

  it("does not include promotional sections", async () => {
    const document = buildMissingListDocument(createEmptyCollection(), generatedAt);
    const result = await createMissingListPdf(document);
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    const pdfText = new TextDecoder("latin1").decode(bytes);

    expect(document.sections.map(({ section }) => section)).not.toContain("Coca-Cola");
    expect(pdfText).not.toContain("Coca-Cola");
  });

  it("does not access IndexedDB or sharing APIs", async () => {
    const restoreIndexedDb = replaceGlobalGetter("indexedDB");
    const restoreNavigator = replaceGlobalGetter("navigator");

    try {
      await createMissingListPdf(
        buildMissingListDocument(createEmptyCollection(), generatedAt),
      );
    } finally {
      restoreNavigator();
      restoreIndexedDb();
    }
  });
});

async function expectPdf(
  blob: Blob,
  expectation:
    | { pages: number; pageSize?: "a4-portrait" }
    | { minPages: number; pageSize?: "a4-portrait" },
): Promise<void> {
  const bytes = new Uint8Array(await blob.arrayBuffer());

  expect(new TextDecoder().decode(bytes.slice(0, 8))).toBe("%PDF-1.7");

  const pdf = await PDFDocument.load(bytes);

  if ("pages" in expectation) {
    expect(pdf.getPageCount()).toBe(expectation.pages);
  } else {
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(expectation.minPages);
  }

  if (expectation.pageSize === "a4-portrait") {
    const firstPage = pdf.getPage(0);

    expect(firstPage.getWidth()).toBeCloseTo(595.28, 2);
    expect(firstPage.getHeight()).toBeCloseTo(841.89, 2);
  }
}

function buildCollectionWithAllPositions(): CollectionState {
  return buildCollectionWithPositions(expandCanonicalAlbumPositions());
}

function buildCollectionWithPositions(positions: PositionRef[]): CollectionState {
  return positions.reduce(
    (collection, position) => setCopies(collection, position, 1),
    createEmptyCollection(),
  );
}

function snapshotDocument(document: MissingListDocument) {
  return {
    generatedAt: document.generatedAt,
    totalCount: document.totalCount,
    ownedCount: document.ownedCount,
    missingCount: document.missingCount,
    sections: document.sections.map((section) => ({
      ...section,
      positions: [...section.positions],
    })),
  };
}

function flattenPlanSections(plan: MissingListPdfLayoutPlan) {
  return plan.pages.flatMap((page) => page.flat());
}

function flattenPlanText(plan: MissingListPdfLayoutPlan): string {
  return flattenPlanSections(plan)
    .flatMap((section) => [
      section.group ?? "",
      section.section,
      ...section.numberLines.map((line) => line.join(" ")),
    ])
    .join("\n");
}

function expectPlanContentWithinMargins(plan: MissingListPdfLayoutPlan): void {
  const availableHeight = plan.contentTop - plan.contentBottom;

  expect(plan.columnWidth).toBeGreaterThan(0);

  for (const page of plan.pages) {
    for (const column of page) {
      const usedHeight = column.reduce((total, block) => total + block.height, 0);

      expect(usedHeight).toBeLessThanOrEqual(availableHeight);
    }
  }
}

function buildRepeatedMissingDocument(repetitions: number): MissingListDocument {
  const completeDocument = buildMissingListDocument(createEmptyCollection(), generatedAt);
  const sections = Array.from({ length: repetitions }, (_, index) =>
    completeDocument.sections.map((section) => ({
      ...section,
      section: `${section.section} ${index + 1}`,
      positions: [...section.positions],
    })),
  ).flat();

  return {
    generatedAt,
    totalCount: repetitions * completeDocument.totalCount,
    ownedCount: 0,
    missingCount: sections.reduce(
      (total, section) => total + section.positions.length,
      0,
    ),
    sections,
  };
}

function replaceGlobalGetter(property: "indexedDB" | "navigator"): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, property);

  Object.defineProperty(globalThis, property, {
    configurable: true,
    get() {
      throw new Error(`${property} should not be accessed`);
    },
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(globalThis, property, descriptor);
    } else {
      Reflect.deleteProperty(globalThis, property);
    }
  };
}
