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
};

const PAGE_SIZE = PageSizes.A4;
const PAGE_WIDTH = PAGE_SIZE[0];
const PAGE_HEIGHT = PAGE_SIZE[1];
const LANDSCAPE_PAGE_SIZE: [number, number] = [PAGE_HEIGHT, PAGE_WIDTH];
export const MIN_READABLE_FONT_SIZE = 7;
const BLACK = rgb(0.09, 0.09, 0.11);
const MUTED = rgb(0.32, 0.32, 0.36);

export type PdfLayoutConfig = {
  orientation: "portrait" | "landscape";
  columns: number;
  marginX: number;
  marginTop: number;
  marginBottom: number;
  columnGap: number;
  headerGap: number;
  titleSize: number;
  summarySize: number;
  groupSize: number;
  sectionSize: number;
  numberSize: number;
  titleLineHeight: number;
  summaryLineHeight: number;
  groupLineHeight: number;
  sectionLineHeight: number;
  numberLineHeight: number;
  groupGap: number;
  titleGap: number;
  blockGap: number;
  numbersPerLine: number;
};

export type PdfLayoutBlock = {
  kind: "complete" | "section";
  section: string;
  group: string | null;
  positions: string[];
  numberLines: string[][];
  height: number;
};

export type MissingListPdfLayoutPlan = {
  config: PdfLayoutConfig;
  pageSize: [number, number];
  headerHeight: number;
  contentTop: number;
  contentBottom: number;
  columnWidth: number;
  pages: PdfLayoutBlock[][][];
};

const LAYOUT_CONFIGS: PdfLayoutConfig[] = [
  {
    orientation: "portrait",
    columns: 1,
    marginX: 36,
    marginTop: 28,
    marginBottom: 28,
    columnGap: 0,
    headerGap: 16,
    titleSize: 12,
    summarySize: 9,
    groupSize: 8.5,
    sectionSize: 8.5,
    numberSize: 8,
    titleLineHeight: 14,
    summaryLineHeight: 11,
    groupLineHeight: 10,
    sectionLineHeight: 10,
    numberLineHeight: 9.5,
    groupGap: 2,
    titleGap: 1,
    blockGap: 5,
    numbersPerLine: 20,
  },
  {
    orientation: "portrait",
    columns: 3,
    marginX: 28,
    marginTop: 24,
    marginBottom: 24,
    columnGap: 10,
    headerGap: 9,
    titleSize: 11,
    summarySize: 8,
    groupSize: 8,
    sectionSize: 8.2,
    numberSize: 7.8,
    titleLineHeight: 13,
    summaryLineHeight: 10,
    groupLineHeight: 9,
    sectionLineHeight: 9.5,
    numberLineHeight: 8.8,
    groupGap: 1.5,
    titleGap: 1,
    blockGap: 3,
    numbersPerLine: 10,
  },
  {
    orientation: "portrait",
    columns: 3,
    marginX: 24,
    marginTop: 22,
    marginBottom: 22,
    columnGap: 8,
    headerGap: 7,
    titleSize: 10,
    summarySize: 7.5,
    groupSize: 7.5,
    sectionSize: 7.7,
    numberSize: MIN_READABLE_FONT_SIZE,
    titleLineHeight: 12,
    summaryLineHeight: 9,
    groupLineHeight: 8.4,
    sectionLineHeight: 8.8,
    numberLineHeight: 8,
    groupGap: 1,
    titleGap: 0.8,
    blockGap: 2.4,
    numbersPerLine: 10,
  },
  {
    orientation: "landscape",
    columns: 4,
    marginX: 24,
    marginTop: 20,
    marginBottom: 20,
    columnGap: 8,
    headerGap: 7,
    titleSize: 10,
    summarySize: 7.5,
    groupSize: 7.5,
    sectionSize: 7.7,
    numberSize: MIN_READABLE_FONT_SIZE,
    titleLineHeight: 12,
    summaryLineHeight: 9,
    groupLineHeight: 8.4,
    sectionLineHeight: 8.8,
    numberLineHeight: 8,
    groupGap: 1,
    titleGap: 0.8,
    blockGap: 2.4,
    numbersPerLine: 10,
  },
];

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
  };

  if (document.missingCount === 0) {
    drawCompleteAlbumPdf(context, document);
  } else {
    const plan = planMissingListPdfLayout(document, {
      regularFont,
      boldFont,
    });

    drawMissingListPdf(context, document, plan);
  }

  drawPageNumbers(context);

  const bytes = await pdf.save();

  return {
    blob: new Blob([copyToArrayBuffer(bytes)], { type: "application/pdf" }),
    filename: buildMissingListPdfFilename(document.generatedAt),
  };
}

function drawCompleteAlbumPdf(
  context: PdfContext,
  document: MissingListDocument,
): void {
  context.page.drawText("ÁLBUM COMPLETO · Álbum de Pedro", {
    x: 36,
    y: PAGE_HEIGHT - 48,
    size: 12,
    font: context.boldFont,
    color: BLACK,
  });
  context.page.drawText(
    `Las ${document.totalCount} figuritas ya están registradas.`,
    {
      x: 36,
      y: PAGE_HEIGHT - 68,
      size: 10,
      font: context.regularFont,
      color: BLACK,
    },
  );
  context.page.drawText(`Actualizada: ${formatDisplayDate(document.generatedAt)}`, {
    x: 36,
    y: PAGE_HEIGHT - 84,
    size: 9,
    font: context.regularFont,
    color: MUTED,
  });
}

export function planMissingListPdfLayout(
  document: MissingListDocument,
  fonts?: { regularFont: PDFFont; boldFont: PDFFont },
): MissingListPdfLayoutPlan {
  const singleColumnConfig = LAYOUT_CONFIGS[0];

  if (document.sections.length <= 12) {
    const plan = buildLayoutPlan(document, singleColumnConfig, fonts);

    if (plan.pages.length === 1) {
      return plan;
    }
  }

  for (const config of LAYOUT_CONFIGS.slice(1)) {
    const plan = buildLayoutPlan(document, config, fonts);

    if (plan.pages.length === 1) {
      return plan;
    }
  }

  return buildLayoutPlan(document, LAYOUT_CONFIGS[2], fonts);
}

function buildLayoutPlan(
  document: MissingListDocument,
  config: PdfLayoutConfig,
  fonts?: { regularFont: PDFFont; boldFont: PDFFont },
): MissingListPdfLayoutPlan {
  const pageSize = getPageSize(config);
  const headerHeight = getHeaderHeight(config);
  const contentTop = pageSize[1] - config.marginTop - headerHeight;
  const contentBottom = config.marginBottom + 14;
  const columnWidth =
    (pageSize[0] - config.marginX * 2 - config.columnGap * (config.columns - 1)) /
    config.columns;
  const blocks = buildLayoutBlocks(document, config, columnWidth, fonts);
  const pages = distributeBlocks(blocks, config.columns, contentTop - contentBottom);

  return {
    config,
    pageSize,
    headerHeight,
    contentTop,
    contentBottom,
    columnWidth,
    pages,
  };
}

function buildLayoutBlocks(
  document: MissingListDocument,
  config: PdfLayoutConfig,
  columnWidth: number,
  fonts?: { regularFont: PDFFont; boldFont: PDFFont },
): PdfLayoutBlock[] {
  let previousGroup: string | null = null;

  return document.sections.map((section) => {
    const group = section.group !== null && section.group !== previousGroup
      ? section.group
      : null;
    const numberLines = buildNumberLines(section.positions, config, columnWidth, fonts);
    const isPanini = section.section === "PANINI";
    const height = isPanini
      ? config.sectionLineHeight + config.blockGap
      : (group ? config.groupLineHeight + config.groupGap : 0) +
        config.sectionLineHeight +
        config.titleGap +
        numberLines.length * config.numberLineHeight +
        config.blockGap;

    previousGroup = section.group;

    return {
      kind: "section",
      section: group === null && isPanini ? `${section.section} · ${section.positions[0]}` : section.section,
      group,
      positions: section.positions,
      numberLines,
      height,
    };
  });
}

function distributeBlocks(
  blocks: PdfLayoutBlock[],
  columnCount: number,
  availableHeight: number,
): PdfLayoutBlock[][][] {
  const pages: PdfLayoutBlock[][][] = [];
  let page = createEmptyColumns(columnCount);
  let columnIndex = 0;
  let usedHeight = 0;

  for (const block of blocks) {
    if (usedHeight + block.height > availableHeight && page[columnIndex].length > 0) {
      columnIndex += 1;
      usedHeight = 0;
    }

    if (columnIndex >= columnCount) {
      pages.push(page);
      page = createEmptyColumns(columnCount);
      columnIndex = 0;
      usedHeight = 0;
    }

    page[columnIndex].push(block);
    usedHeight += block.height;
  }

  pages.push(page);

  return pages;
}

function createEmptyColumns(columnCount: number): PdfLayoutBlock[][] {
  return Array.from({ length: columnCount }, () => []);
}

function buildNumberLines(
  positions: string[],
  config: PdfLayoutConfig,
  columnWidth: number,
  fonts?: { regularFont: PDFFont; boldFont: PDFFont },
): string[][] {
  const lines: string[][] = [];
  const maxItemsPerLine = getMaxNumbersPerLine(positions, config, columnWidth, fonts);

  for (let index = 0; index < positions.length; index += maxItemsPerLine) {
    lines.push(positions.slice(index, index + maxItemsPerLine));
  }

  return lines;
}

function getMaxNumbersPerLine(
  positions: string[],
  config: PdfLayoutConfig,
  columnWidth: number,
  fonts?: { regularFont: PDFFont; boldFont: PDFFont },
): number {
  if (!fonts) {
    return config.numbersPerLine;
  }

  for (let count = config.numbersPerLine; count > 1; count -= 1) {
    const widestLine = positions.slice(0, count).join("  ");

    if (fonts.regularFont.widthOfTextAtSize(widestLine, config.numberSize) <= columnWidth) {
      return count;
    }
  }

  return 1;
}

function drawMissingListPdf(
  context: PdfContext,
  document: MissingListDocument,
  plan: MissingListPdfLayoutPlan,
): void {
  context.pdf.removePage(0);

  for (const pageColumns of plan.pages) {
    context.page = context.pdf.addPage(plan.pageSize);
    drawCompactHeader(context, document, plan);

    pageColumns.forEach((blocks, columnIndex) => {
      const x =
        plan.config.marginX +
        columnIndex * (plan.columnWidth + plan.config.columnGap);
      let y = plan.contentTop;

      for (const block of blocks) {
        y = drawLayoutBlock(context, block, plan.config, x, y);
      }
    });
  }
}

function drawCompactHeader(
  context: PdfContext,
  document: MissingListDocument,
  plan: MissingListPdfLayoutPlan,
): void {
  const { config } = plan;
  const top = plan.pageSize[1] - config.marginTop;
  const title = "FIGURITAS FALTANTES · Álbum de Pedro";
  const summary =
    `${document.missingCount} faltantes de ${document.totalCount}` +
    ` · Actualizada ${formatDisplayDate(document.generatedAt)}`;

  context.page.drawText(title, {
    x: config.marginX,
    y: top - config.titleSize,
    size: config.titleSize,
    font: context.boldFont,
    color: BLACK,
  });
  context.page.drawText(summary, {
    x: config.marginX,
    y: top - config.titleLineHeight - config.summarySize,
    size: config.summarySize,
    font: context.regularFont,
    color: MUTED,
  });
}

function drawLayoutBlock(
  context: PdfContext,
  block: PdfLayoutBlock,
  config: PdfLayoutConfig,
  x: number,
  y: number,
): number {
  if (block.group) {
    context.page.drawText(block.group.toUpperCase(), {
      x,
      y: y - config.groupSize,
      size: config.groupSize,
      font: context.boldFont,
      color: BLACK,
    });
    y -= config.groupLineHeight + config.groupGap;
  }

  context.page.drawText(block.section, {
    x,
    y: y - config.sectionSize,
    size: config.sectionSize,
    font: context.boldFont,
    color: BLACK,
  });
  y -= config.sectionLineHeight;

  if (block.section === "PANINI · 00") {
    return y - config.blockGap;
  }

  y -= config.titleGap;

  for (const line of block.numberLines) {
    context.page.drawText(line.join("  "), {
      x,
      y: y - config.numberSize,
      size: config.numberSize,
      font: context.regularFont,
      color: BLACK,
    });
    y -= config.numberLineHeight;
  }

  return y - config.blockGap;
}

function getPageSize(config: PdfLayoutConfig): [number, number] {
  return config.orientation === "portrait" ? PAGE_SIZE : LANDSCAPE_PAGE_SIZE;
}

function getHeaderHeight(config: PdfLayoutConfig): number {
  return config.titleLineHeight + config.summaryLineHeight + config.headerGap;
}

function drawPageNumbers(context: PdfContext): void {
  const pages = context.pdf.getPages();

  for (const [index, page] of pages.entries()) {
    const size = 7;
    const pageWidth = page.getWidth();
    const width = context.regularFont.widthOfTextAtSize(`${index + 1} / ${pages.length}`, size);

    page.drawText(`${index + 1} / ${pages.length}`, {
      x: pageWidth - 28 - width,
      y: 14,
      size,
      font: context.regularFont,
      color: MUTED,
    });
  }
}

export const __missingListPdfTestUtils = {
  buildLayoutPlan,
  buildNumberLines,
  planMissingListPdfLayout,
};

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
