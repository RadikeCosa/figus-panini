import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { expandCanonicalAlbumPositions } from "../../domain/album/canonical-album";
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
import { createMissingListPdf } from "./missing-list-pdf";

const generatedAt = new Date("2026-07-30T15:20:10.000Z");

describe("missing list PDF generator", () => {
  it("returns a PDF Blob with a predictable filename", async () => {
    const result = await createMissingListPdf(
      buildMissingListDocument(createEmptyCollection(), generatedAt),
    );

    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.blob.type).toBe("application/pdf");
    expect(result.filename).toBe("figuritas-faltantes-2026-07-30.pdf");
    await expectPdf(result.blob, { minPages: 2 });
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

  it("generates a multipage PDF for the empty collection with 980 missing positions", async () => {
    const result = await createMissingListPdf(
      buildMissingListDocument(createEmptyCollection(), generatedAt),
    );
    const pdf = await loadPdf(result.blob);

    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(result.blob.size).toBeGreaterThan(3_000);
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
    await expectPdf(result.blob, { pages: 1 });
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
  expectation: { pages: number } | { minPages: number },
): Promise<void> {
  const bytes = new Uint8Array(await blob.arrayBuffer());

  expect(new TextDecoder().decode(bytes.slice(0, 8))).toBe("%PDF-1.7");

  const pdf = await PDFDocument.load(bytes);

  if ("pages" in expectation) {
    expect(pdf.getPageCount()).toBe(expectation.pages);
  } else {
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(expectation.minPages);
  }
}

async function loadPdf(blob: Blob): Promise<PDFDocument> {
  return PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
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
