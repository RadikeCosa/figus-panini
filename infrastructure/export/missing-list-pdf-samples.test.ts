import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { expandCanonicalAlbumPositions } from "../../domain/album/canonical-album";
import {
  createEmptyCollection,
  setCopies,
  type CollectionState,
  type PositionRef,
} from "../../domain/collection/collection";
import { buildMissingListDocument } from "../../domain/collection/missing-list-document";
import { createMissingListPdf } from "./missing-list-pdf";

const generatedAt = new Date("2026-07-30T15:20:10.000Z");
const outputDir =
  process.env.MISSING_LIST_PDF_SAMPLE_DIR ??
  "/tmp/figus-pani-missing-list-pdf-samples";
const shouldGenerate = process.env.GENERATE_MISSING_LIST_PDF_SAMPLES === "1";

describe.skipIf(!shouldGenerate)("missing list PDF samples", () => {
  it("writes sample PDFs for manual review", async () => {
    await mkdir(outputDir, { recursive: true });

    const samples = [
      {
        filename: "album-completo.pdf",
        collection: buildCollectionWithAllPositions(),
      },
      {
        filename: "pocos-faltantes.pdf",
        collection: buildFewMissingCollection(),
      },
      {
        filename: "coleccion-vacia-980-faltantes.pdf",
        collection: createEmptyCollection(),
      },
      {
        filename: "faltantes-fragmentados.pdf",
        collection: buildFragmentedMissingCollection(),
      },
    ];

    for (const sample of samples) {
      const document = buildMissingListDocument(sample.collection, generatedAt);
      const result = await createMissingListPdf(document);
      const bytes = new Uint8Array(await result.blob.arrayBuffer());

      await writeFile(join(outputDir, sample.filename), bytes);
    }

    expect(outputDir).toBeTruthy();
  });
});

function buildFewMissingCollection(): CollectionState {
  const missingIdentities = new Set([
    "México-1",
    "México-4",
    "Países Bajos-3",
    "Túnez-8",
    "Bélgica-9",
    "España-12",
    "Curazao-15",
    "Corea del Sur-18",
    "Costa de Marfil-20",
  ]);

  return buildCollectionWithPositions(
    expandCanonicalAlbumPositions().filter(
      (position) =>
        !missingIdentities.has(`${position.section}-${position.position}`),
    ),
  );
}

function buildFragmentedMissingCollection(): CollectionState {
  const missingIdentities = new Set(
    expandCanonicalAlbumPositions()
      .filter((position) => {
        if (position.section === "PANINI") {
          return true;
        }

        const numericPosition = Number(position.position);

        if (position.section === "FWC") {
          return numericPosition % 3 === 1;
        }

        return numericPosition % 4 === 1 || numericPosition % 4 === 2;
      })
      .map((position) => `${position.section}-${position.position}`),
  );

  return buildCollectionWithPositions(
    expandCanonicalAlbumPositions().filter(
      (position) =>
        !missingIdentities.has(`${position.section}-${position.position}`),
    ),
  );
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
