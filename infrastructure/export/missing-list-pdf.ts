import {
  PDFDocument,
  PageSizes,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { MissingListDocument } from "../../domain/collection/missing-list-document";

export type MissingListPdfResult = {
  blob: Blob;
  filename: string;
};

type PdfContext = {
  pdf: PDFDocument;
  page: PDFPage;
  regularFont: PDFFont;
  boldFont: PDFFont;
  y: number;
};

const PAGE_SIZE = PageSizes.A4;
const PAGE_WIDTH = PAGE_SIZE[0];
const PAGE_HEIGHT = PAGE_SIZE[1];
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_SPACE = 42;
const BLACK = rgb(0.09, 0.09, 0.11);
const MUTED = rgb(0.32, 0.32, 0.36);
const RULE = rgb(0.78, 0.78, 0.82);

export async function createMissingListPdf(
  document: MissingListDocument,
): Promise<MissingListPdfResult> {
  const pdf = await PDFDocument.create();
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const context: PdfContext = {
    pdf,
    page: pdf.addPage(PAGE_SIZE),
    regularFont,
    boldFont,
    y: PAGE_HEIGHT - MARGIN,
  };

  drawMainHeader(context, document);

  if (document.missingCount === 0) {
    drawCompleteAlbumMessage(context, document);
  } else {
    drawMissingSections(context, document);
  }

  drawPageNumbers(context);

  const bytes = await pdf.save();

  return {
    blob: new Blob([copyToArrayBuffer(bytes)], { type: "application/pdf" }),
    filename: buildMissingListPdfFilename(document.generatedAt),
  };
}

function drawMainHeader(context: PdfContext, document: MissingListDocument): void {
  drawText(context, "Figuritas faltantes", {
    font: context.boldFont,
    size: 22,
    lineHeight: 27,
  });
  drawText(context, "Álbum de Pedro", {
    font: context.regularFont,
    size: 14,
    lineHeight: 21,
    color: MUTED,
  });
  moveDown(context, 10);
  drawText(context, `Actualizada: ${formatDisplayDate(document.generatedAt)}`, {
    font: context.regularFont,
    size: 10,
    lineHeight: 16,
    color: MUTED,
  });
  moveDown(context, 8);

  if (document.missingCount > 0) {
    const percentage = getCompletionPercentage(document);

    drawText(
      context,
      `Faltan ${document.missingCount} de ${document.totalCount} figuritas`,
      {
        font: context.boldFont,
        size: 13,
        lineHeight: 19,
      },
    );
    drawText(context, `${document.ownedCount} pegadas · ${percentage}% completo`, {
      font: context.regularFont,
      size: 11,
      lineHeight: 17,
      color: MUTED,
    });
  }

  moveDown(context, 16);
  drawHorizontalRule(context);
  moveDown(context, 18);
}

function drawCompleteAlbumMessage(
  context: PdfContext,
  document: MissingListDocument,
): void {
  drawText(context, "Álbum completo", {
    font: context.boldFont,
    size: 16,
    lineHeight: 24,
  });
  moveDown(context, 4);
  drawText(
    context,
    `Pedro ya tiene las ${document.totalCount} figuritas del álbum.`,
    {
      font: context.regularFont,
      size: 12,
      lineHeight: 18,
    },
  );
  drawText(
    context,
    `Lista actualizada el ${formatDisplayDate(document.generatedAt)}.`,
    {
      font: context.regularFont,
      size: 12,
      lineHeight: 18,
    },
  );
}

function drawMissingSections(
  context: PdfContext,
  document: MissingListDocument,
): void {
  let previousGroup: string | null = null;

  for (const section of document.sections) {
    const positionLines = wrapPositions(
      section.positions,
      context.regularFont,
      11,
      CONTENT_WIDTH,
    );
    const shouldDrawGroup = section.group !== null && section.group !== previousGroup;
    const minimumBlockHeight =
      (shouldDrawGroup ? 25 : 0) + 21 + Math.min(positionLines.length, 2) * 16;

    ensureSpace(context, minimumBlockHeight);

    if (shouldDrawGroup && section.group) {
      drawText(context, section.group, {
        font: context.boldFont,
        size: 11,
        lineHeight: 18,
      });
      moveDown(context, 3);
    }

    drawText(context, section.section, {
      font: context.boldFont,
      size: 12,
      lineHeight: 18,
    });

    for (const line of positionLines) {
      drawText(context, line, {
        font: context.regularFont,
        size: 11,
        lineHeight: 16,
      });
    }

    moveDown(context, 10);
    previousGroup = section.group;
  }
}

function drawText(
  context: PdfContext,
  text: string,
  options: {
    font: PDFFont;
    size: number;
    lineHeight: number;
    color?: ReturnType<typeof rgb>;
  },
): void {
  ensureSpace(context, options.lineHeight);
  context.page.drawText(text, {
    x: MARGIN,
    y: context.y - options.size,
    size: options.size,
    font: options.font,
    color: options.color ?? BLACK,
  });
  context.y -= options.lineHeight;
}

function drawHorizontalRule(context: PdfContext): void {
  context.page.drawLine({
    start: { x: MARGIN, y: context.y },
    end: { x: PAGE_WIDTH - MARGIN, y: context.y },
    thickness: 0.75,
    color: RULE,
  });
}

function drawPageNumbers(context: PdfContext): void {
  const pages = context.pdf.getPages();

  for (const [index, page] of pages.entries()) {
    const pageLabel = `${index + 1} / ${pages.length}`;
    const size = 9;
    const width = context.regularFont.widthOfTextAtSize(pageLabel, size);

    page.drawText(pageLabel, {
      x: PAGE_WIDTH - MARGIN - width,
      y: 24,
      size,
      font: context.regularFont,
      color: MUTED,
    });
  }
}

function ensureSpace(context: PdfContext, requiredHeight: number): void {
  if (context.y - requiredHeight >= FOOTER_SPACE) {
    return;
  }

  context.page = context.pdf.addPage(PAGE_SIZE);
  context.y = PAGE_HEIGHT - MARGIN;
}

function moveDown(context: PdfContext, amount: number): void {
  context.y -= amount;
}

function wrapPositions(
  positions: string[],
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let currentLine = "";

  for (const position of positions) {
    const candidate = currentLine === "" ? position : `${currentLine}, ${position}`;

    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine !== "") {
      lines.push(currentLine);
    }

    currentLine = position;
  }

  if (currentLine !== "") {
    lines.push(currentLine);
  }

  return lines;
}

function getCompletionPercentage(document: MissingListDocument): number {
  if (document.totalCount === 0) {
    return 0;
  }

  return Math.round((document.ownedCount / document.totalCount) * 100);
}

function buildMissingListPdfFilename(generatedAt: Date): string {
  return `figuritas-faltantes-${generatedAt.toISOString().slice(0, 10)}.pdf`;
}

function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);

  new Uint8Array(buffer).set(bytes);

  return buffer;
}
