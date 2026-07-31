/**
 * @vitest-environment jsdom
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expandCanonicalAlbumPositions } from "../../domain/album/canonical-album";
import {
  createEmptyCollection,
  getCopies,
  setCopies,
  type CollectionState,
} from "../../domain/collection/collection";
import type { MissingListDocument } from "../../domain/collection/missing-list-document";
import type { CopyTextResult } from "../../infrastructure/export/copy-text";
import type { MissingListPdfResult } from "../../infrastructure/export/missing-list-pdf";
import type { ShareOrDownloadFileResult } from "../../infrastructure/export/share-or-download-file";
import type { CollectionRepository } from "../../infrastructure/persistence/collection-repository";
import { CollectionViews } from "./collection-views";

const panini = { section: "PANINI", position: "00" };
const mexico1 = { section: "México", position: "1" };
const mexico2 = { section: "México", position: "2" };
const mexico12 = { section: "México", position: "12" };
const argentina7 = { section: "Argentina", position: "7" };
const argentina18 = { section: "Argentina", position: "18" };
const panama20 = { section: "Panamá", position: "20" };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CollectionViews missing", () => {
  it("shows loading before resolving the collection", () => {
    render(
      <CollectionViews
        mode="missing"
        createRepository={() => ({
          load: () => new Promise<CollectionState>(() => undefined),
          save: async () => undefined,
          clear: async () => undefined,
        })}
      />,
    );

    expect(screen.getByText("Cargando colección")).toBeTruthy();
    expect(screen.getByText("Calculando faltantes...")).toBeTruthy();
  });

  it("shows load error and retries", async () => {
    const load = vi
      .fn<() => Promise<CollectionState>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(createEmptyCollection());
    const repository: CollectionRepository = {
      load,
      save: async () => undefined,
      clear: async () => undefined,
    };

    render(<CollectionViews mode="missing" createRepository={() => repository} />);

    expect(await screen.findByText("No fue posible cargar faltantes")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("heading", { name: "980 faltantes" })).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shows an empty collection with 980 missing positions", async () => {
    render(<CollectionViews mode="missing" createRepository={() => fakeRepository(createEmptyCollection())} />);

    expect(await screen.findByRole("heading", { name: "980 faltantes" })).toBeTruthy();
    expect(screen.getByText("0 de 980 pegadas")).toBeTruthy();
    expect(screen.getByText("Tu colección guardada está vacía.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "PANINI" })).toBeTruthy();
    expect(screen.getByText("1 faltantes · 0 de 1 pegadas")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "FWC" })).toBeTruthy();
    expect(screen.getByText("19 faltantes · 0 de 19 pegadas")).toBeTruthy();
  });

  it("shows the share list button only in the missing view after loading", async () => {
    render(<CollectionViews mode="missing" createRepository={() => fakeRepository(createEmptyCollection())} />);

    expect(await screen.findByRole("button", { name: "Compartir PDF" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copiar como texto" })).toBeTruthy();
  });

  it("shows a partial collection grouped by canonical section order", async () => {
    const collection = setCopies(
      setCopies(setCopies(createEmptyCollection(), panini, 1), mexico1, 1),
      argentina7,
      1,
    );

    render(<CollectionViews mode="missing" createRepository={() => fakeRepository(collection)} />);

    expect(await screen.findByRole("heading", { name: "977 faltantes" })).toBeTruthy();
    const headings = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(headings.slice(0, 3)).toEqual(["FWC", "México", "Sudáfrica"]);
    expect(screen.getByRole("heading", { name: "Argentina" })).toBeTruthy();
  });

  it("shows a clear empty state for a complete collection", async () => {
    const collection = expandCanonicalAlbumPositions().reduce(
      (current, position) => setCopies(current, position, 1),
      createEmptyCollection(),
    );

    render(<CollectionViews mode="missing" createRepository={() => fakeRepository(collection)} />);

    expect(await screen.findByText("No te falta ninguna figurita.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "0 faltantes" })).toBeTruthy();
  });

  it("filters missing positions by section without reloading", async () => {
    const load = vi.fn<() => Promise<CollectionState>>().mockResolvedValue(
      setCopies(createEmptyCollection(), mexico1, 1),
    );
    const repository: CollectionRepository = {
      load,
      save: vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined),
      clear: vi.fn<CollectionRepository["clear"]>().mockResolvedValue(undefined),
    };

    render(<CollectionViews mode="missing" createRepository={() => repository} />);

    await screen.findByRole("heading", { name: "979 faltantes" });
    selectSection("México");

    expect(screen.getByRole("heading", { name: "México" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "FWC" })).toBeNull();
    expect(screen.getByText("Filtro activo: México")).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("copies the complete missing list text from the loaded collection after filtering", async () => {
    const loadedCollection = setCopies(createEmptyCollection(), mexico1, 1);
    const beforeCopy = collectionSnapshot(loadedCollection);
    const load = vi.fn<() => Promise<CollectionState>>().mockResolvedValue(
      loadedCollection,
    );
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const repository: CollectionRepository = {
      load,
      save,
      clear: vi.fn<CollectionRepository["clear"]>().mockResolvedValue(undefined),
    };
    const formatMissingListMessage = vi.fn<(document: MissingListDocument) => string>(
      () => "Estas son las figuritas que nos faltan:\n\nFWC: 1, 2",
    );
    const copyText = vi
      .fn<(text: string) => Promise<CopyTextResult>>()
      .mockResolvedValue({ status: "copied" });

    render(
      <CollectionViews
        mode="missing"
        createRepository={() => repository}
        copyText={copyText}
        formatMissingListMessage={formatMissingListMessage}
        now={() => new Date("2026-07-30T10:00:00.000Z")}
      />,
    );

    await screen.findByRole("heading", { name: "979 faltantes" });
    selectSection("México");
    fireEvent.click(screen.getByRole("button", { name: "Copiar como texto" }));

    expect(await waitForMockCall(copyText)).toBeTruthy();
    expect(formatMissingListMessage).toHaveBeenCalledTimes(1);
    expect(formatMissingListMessage.mock.calls[0][0]).toMatchObject({
      generatedAt: new Date("2026-07-30T10:00:00.000Z"),
      totalCount: 980,
      ownedCount: 1,
      missingCount: 979,
    });
    expect(
      formatMissingListMessage.mock.calls[0][0].sections.some(
        ({ section }) => section === "FWC",
      ),
    ).toBe(true);
    expect(
      formatMissingListMessage.mock.calls[0][0].sections.find(
        ({ section }) => section === "México",
      )?.positions,
    ).toEqual(Array.from({ length: 19 }, (_, index) => String(index + 2)));
    expect(copyText).toHaveBeenCalledWith(
      "Estas son las figuritas que nos faltan:\n\nFWC: 1, 2",
    );
    expect(
      await screen.findByText("Lista copiada. Ya podés pegarla en WhatsApp."),
    ).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(collectionSnapshot(loadedCollection)).toEqual(beforeCopy);
  });

  it("does not call the text formatter or clipboard before clicking copy", async () => {
    const formatMissingListMessage = vi.fn<(document: MissingListDocument) => string>(
      () => "lista",
    );
    const copyText = vi
      .fn<(text: string) => Promise<CopyTextResult>>()
      .mockResolvedValue({ status: "copied" });

    render(
      <CollectionViews
        mode="missing"
        createRepository={() => fakeRepository(createEmptyCollection())}
        copyText={copyText}
        formatMissingListMessage={formatMissingListMessage}
      />,
    );

    await screen.findByRole("heading", { name: "980 faltantes" });

    expect(formatMissingListMessage).not.toHaveBeenCalled();
    expect(copyText).not.toHaveBeenCalled();
  });

  it("disables duplicate copy execution and shows copying state", async () => {
    const resolveCopyRef: {
      current: ((value: CopyTextResult | PromiseLike<CopyTextResult>) => void) | null;
    } = { current: null };
    const copyText = vi.fn(
      () =>
        new Promise<CopyTextResult>((resolve) => {
          resolveCopyRef.current = resolve;
        }),
    );

    render(
      <CollectionViews
        mode="missing"
        createRepository={() => fakeRepository(createEmptyCollection())}
        copyText={copyText}
        formatMissingListMessage={() => "lista"}
      />,
    );

    await screen.findByRole("heading", { name: "980 faltantes" });
    const copyButton = screen.getByRole("button", {
      name: "Copiar como texto",
    }) as HTMLButtonElement;

    fireEvent.click(copyButton);

    expect(await screen.findByRole("button", { name: "Copiando…" })).toBeTruthy();
    expect(copyButton.disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Compartir PDF" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(copyButton);
    expect(copyText).toHaveBeenCalledTimes(1);

    if (!resolveCopyRef.current) {
      throw new Error("Copy promise was not started.");
    }

    resolveCopyRef.current({ status: "copied" });

    expect(await screen.findByRole("button", { name: "Copiar como texto" })).toBeTruthy();
  });

  it("shows manual copy text when automatic fallback cannot copy", async () => {
    render(
      <CollectionViews
        mode="missing"
        createRepository={() => fakeRepository(createEmptyCollection())}
        copyText={async () => ({ status: "manual", text: "PANINI: 00" })}
        formatMissingListMessage={() => "PANINI: 00"}
      />,
    );

    await screen.findByRole("heading", { name: "980 faltantes" });
    fireEvent.click(screen.getByRole("button", { name: "Copiar como texto" }));

    expect(
      await screen.findByText(
        "No se pudo copiar automáticamente. Seleccioná el texto y copiá.",
      ),
    ).toBeTruthy();
    expect(screen.getByDisplayValue("PANINI: 00")).toBeTruthy();
  });

  it("shows a retryable error when copying text fails", async () => {
    const copyText = vi
      .fn<(text: string) => Promise<CopyTextResult>>()
      .mockRejectedValueOnce(new Error("clipboard"))
      .mockResolvedValueOnce({ status: "copied" });

    render(
      <CollectionViews
        mode="missing"
        createRepository={() => fakeRepository(createEmptyCollection())}
        copyText={copyText}
        formatMissingListMessage={() => "lista"}
      />,
    );

    await screen.findByRole("heading", { name: "980 faltantes" });
    fireEvent.click(screen.getByRole("button", { name: "Copiar como texto" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "No se pudo copiar la lista.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Copiar como texto" }));
    expect(await waitForMockCallCount(copyText, 2)).toBeTruthy();
    expect(
      await screen.findByText("Lista copiada. Ya podés pegarla en WhatsApp."),
    ).toBeTruthy();
  });

  it("copies a friendly complete album message", async () => {
    const collection = expandCanonicalAlbumPositions().reduce(
      (current, position) => setCopies(current, position, 1),
      createEmptyCollection(),
    );
    const copyText = vi
      .fn<(text: string) => Promise<CopyTextResult>>()
      .mockResolvedValue({ status: "copied" });

    render(
      <CollectionViews
        mode="missing"
        createRepository={() => fakeRepository(collection)}
        copyText={copyText}
      />,
    );

    await screen.findByText("No te falta ninguna figurita.");
    fireEvent.click(screen.getByRole("button", { name: "Copiar como texto" }));

    expect(await waitForMockCall(copyText)).toBeTruthy();
    expect(copyText).toHaveBeenCalledWith(
      "¡Álbum completo! Ya tenemos las 980 figuritas.",
    );
  });

  it("shares the complete missing list from the loaded collection after filtering", async () => {
    const loadedCollection = setCopies(createEmptyCollection(), mexico1, 1);
    const beforeExport = collectionSnapshot(loadedCollection);
    const load = vi.fn<() => Promise<CollectionState>>().mockResolvedValue(
      loadedCollection,
    );
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const repository: CollectionRepository = {
      load,
      save,
      clear: vi.fn<CollectionRepository["clear"]>().mockResolvedValue(undefined),
    };
    const createMissingListPdf = vi
      .fn<(document: MissingListDocument) => Promise<MissingListPdfResult>>()
      .mockResolvedValue({
        blob: new Blob(["pdf"], { type: "application/pdf" }),
        filename: "figuritas-faltantes-2026-07-30.pdf",
      });
    const shareOrDownloadFile = vi
      .fn<
        (file: File, options: { title: string; text: string }) => Promise<ShareOrDownloadFileResult>
      >()
      .mockResolvedValue({ status: "shared" });

    render(
      <CollectionViews
        mode="missing"
        createRepository={() => repository}
        createMissingListPdf={createMissingListPdf}
        now={() => new Date("2026-07-30T10:00:00.000Z")}
        shareOrDownloadFile={shareOrDownloadFile}
      />,
    );

    await screen.findByRole("heading", { name: "979 faltantes" });
    selectSection("México");
    fireEvent.click(screen.getByRole("button", { name: "Compartir PDF" }));

    expect(await waitForMockCall(createMissingListPdf)).toBeTruthy();
    expect(createMissingListPdf).toHaveBeenCalledTimes(1);
    expect(createMissingListPdf.mock.calls[0][0]).toMatchObject({
      generatedAt: new Date("2026-07-30T10:00:00.000Z"),
      totalCount: 980,
      ownedCount: 1,
      missingCount: 979,
    });
    expect(
      createMissingListPdf.mock.calls[0][0].sections.some(
        ({ section }) => section === "FWC",
      ),
    ).toBe(true);
    expect(
      createMissingListPdf.mock.calls[0][0].sections.find(
        ({ section }) => section === "México",
      )?.positions,
    ).toEqual(Array.from({ length: 19 }, (_, index) => String(index + 2)));
    expect(shareOrDownloadFile).toHaveBeenCalledTimes(1);
    const sharedFile = shareOrDownloadFile.mock.calls[0][0];
    expect(sharedFile).toBeInstanceOf(File);
    expect(sharedFile.name).toBe("figuritas-faltantes-2026-07-30.pdf");
    expect(sharedFile.type).toBe("application/pdf");
    expect(shareOrDownloadFile.mock.calls[0][1]).toEqual({
      title: "Figuritas faltantes",
      text: "Estas son las figuritas que nos faltan para completar el álbum.",
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(collectionSnapshot(loadedCollection)).toEqual(beforeExport);
  });

  it("loads the PDF generator only after clicking and disables duplicate execution", async () => {
    const resolvePdfRef: {
      current:
        | ((value: MissingListPdfResult | PromiseLike<MissingListPdfResult>) => void)
        | null;
    } = { current: null };
    const createMissingListPdf = vi.fn(
      () =>
        new Promise<MissingListPdfResult>((resolve) => {
          resolvePdfRef.current = resolve;
        }),
    );
    const shareOrDownloadFile = vi
      .fn<
        (file: File, options: { title: string; text: string }) => Promise<ShareOrDownloadFileResult>
      >()
      .mockResolvedValue({ status: "shared" });

    render(
      <CollectionViews
        mode="missing"
        createRepository={() => fakeRepository(createEmptyCollection())}
        createMissingListPdf={createMissingListPdf}
        shareOrDownloadFile={shareOrDownloadFile}
      />,
    );

    await screen.findByRole("heading", { name: "980 faltantes" });
    expect(createMissingListPdf).not.toHaveBeenCalled();

    const button = screen.getByRole("button", {
      name: "Compartir PDF",
    }) as HTMLButtonElement;
    fireEvent.click(button);

    expect(await screen.findByRole("button", { name: "Generando PDF…" })).toBeTruthy();
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(createMissingListPdf).toHaveBeenCalledTimes(1);

    if (!resolvePdfRef.current) {
      throw new Error("PDF generation promise was not started.");
    }

    resolvePdfRef.current({
      blob: new Blob(["pdf"], { type: "application/pdf" }),
      filename: "figuritas-faltantes-2026-07-30.pdf",
    });

    expect(await screen.findByRole("button", { name: "Compartir PDF" })).toBeTruthy();
    expect(shareOrDownloadFile).toHaveBeenCalledTimes(1);
  });

  it("does not show an error or download after share cancellation and allows retry", async () => {
    const createMissingListPdf = vi
      .fn<(document: MissingListDocument) => Promise<MissingListPdfResult>>()
      .mockResolvedValue({
        blob: new Blob(["pdf"], { type: "application/pdf" }),
        filename: "figuritas-faltantes-2026-07-30.pdf",
      });
    const shareOrDownloadFile = vi
      .fn<
        (file: File, options: { title: string; text: string }) => Promise<ShareOrDownloadFileResult>
      >()
      .mockResolvedValueOnce({ status: "canceled" })
      .mockResolvedValueOnce({ status: "shared" });

    render(
      <CollectionViews
        mode="missing"
        createRepository={() => fakeRepository(createEmptyCollection())}
        createMissingListPdf={createMissingListPdf}
        shareOrDownloadFile={shareOrDownloadFile}
      />,
    );

    await screen.findByRole("heading", { name: "980 faltantes" });
    fireEvent.click(screen.getByRole("button", { name: "Compartir PDF" }));

    expect(await screen.findByRole("button", { name: "Compartir PDF" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/PDF quedó descargado/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Compartir PDF" }));
    expect(await waitForMockCallCount(shareOrDownloadFile, 2)).toBeTruthy();
  });

  it("shows a download fallback message when sharing files is not supported", async () => {
    const createMissingListPdf = vi
      .fn<(document: MissingListDocument) => Promise<MissingListPdfResult>>()
      .mockResolvedValue({
        blob: new Blob(["pdf"], { type: "application/pdf" }),
        filename: "figuritas-faltantes-2026-07-30.pdf",
      });
    const shareOrDownloadFile = vi
      .fn<
        (file: File, options: { title: string; text: string }) => Promise<ShareOrDownloadFileResult>
      >()
      .mockResolvedValue({ status: "downloaded" });

    render(
      <CollectionViews
        mode="missing"
        createRepository={() => fakeRepository(createEmptyCollection())}
        createMissingListPdf={createMissingListPdf}
        shareOrDownloadFile={shareOrDownloadFile}
      />,
    );

    await screen.findByRole("heading", { name: "980 faltantes" });
    fireEvent.click(screen.getByRole("button", { name: "Compartir PDF" }));

    expect(
      await screen.findByText(
        "El PDF quedó descargado. Podés enviarlo desde WhatsApp como documento.",
      ),
    ).toBeTruthy();
  });

  it("generates a real PDF through the default dynamic generator after clicking", async () => {
    const shareOrDownloadFile = vi
      .fn<
        (file: File, options: { title: string; text: string }) => Promise<ShareOrDownloadFileResult>
      >()
      .mockResolvedValue({ status: "downloaded" });

    render(
      <CollectionViews
        mode="missing"
        createRepository={() => fakeRepository(createEmptyCollection())}
        now={() => new Date("2026-07-30T10:00:00.000Z")}
        shareOrDownloadFile={shareOrDownloadFile}
      />,
    );

    await screen.findByRole("heading", { name: "980 faltantes" });
    fireEvent.click(screen.getByRole("button", { name: "Compartir PDF" }));

    expect(await waitForMockCall(shareOrDownloadFile)).toBeTruthy();
    const file = shareOrDownloadFile.mock.calls[0][0];
    const header = new TextDecoder().decode(
      new Uint8Array(await file.slice(0, 8).arrayBuffer()),
    );

    expect(file.name).toBe("figuritas-faltantes-2026-07-30.pdf");
    expect(file.type).toBe("application/pdf");
    expect(file.size).toBeGreaterThan(3_000);
    expect(header).toBe("%PDF-1.7");
  });

  it("shows a retryable error when PDF generation fails", async () => {
    const createMissingListPdf = vi
      .fn<(document: MissingListDocument) => Promise<MissingListPdfResult>>()
      .mockRejectedValueOnce(new Error("pdf"))
      .mockResolvedValueOnce({
        blob: new Blob(["pdf"], { type: "application/pdf" }),
        filename: "figuritas-faltantes-2026-07-30.pdf",
      });
    const shareOrDownloadFile = vi
      .fn<
        (file: File, options: { title: string; text: string }) => Promise<ShareOrDownloadFileResult>
      >()
      .mockResolvedValue({ status: "shared" });

    render(
      <CollectionViews
        mode="missing"
        createRepository={() => fakeRepository(createEmptyCollection())}
        createMissingListPdf={createMissingListPdf}
        shareOrDownloadFile={shareOrDownloadFile}
      />,
    );

    await screen.findByRole("heading", { name: "980 faltantes" });
    fireEvent.click(screen.getByRole("button", { name: "Compartir PDF" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "No se pudo generar la lista. Intentá nuevamente.",
    );
    expect(shareOrDownloadFile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Compartir PDF" }));
    expect(await waitForMockCall(shareOrDownloadFile)).toBeTruthy();
  });

  it("keeps the share button enabled for a complete album", async () => {
    const collection = expandCanonicalAlbumPositions().reduce(
      (current, position) => setCopies(current, position, 1),
      createEmptyCollection(),
    );
    const createMissingListPdf = vi
      .fn<(document: MissingListDocument) => Promise<MissingListPdfResult>>()
      .mockResolvedValue({
        blob: new Blob(["pdf"], { type: "application/pdf" }),
        filename: "figuritas-faltantes-2026-07-30.pdf",
      });

    render(
      <CollectionViews
        mode="missing"
        createRepository={() => fakeRepository(collection)}
        createMissingListPdf={createMissingListPdf}
        shareOrDownloadFile={async () => ({ status: "shared" })}
      />,
    );

    await screen.findByText("No te falta ninguna figurita.");
    fireEvent.click(screen.getByRole("button", { name: "Compartir PDF" }));

    expect(await waitForMockCall(createMissingListPdf)).toBeTruthy();
    expect(createMissingListPdf.mock.calls[0][0]).toMatchObject({
      ownedCount: 980,
      missingCount: 0,
      sections: [],
    });
  });

  it("shows filter empty state when the selected section has no missing positions", async () => {
    const collection = expandCanonicalAlbumPositions()
      .filter((position) => position.section === "México")
      .reduce((current, position) => setCopies(current, position, 1), createEmptyCollection());

    render(<CollectionViews mode="missing" createRepository={() => fakeRepository(collection)} />);

    await screen.findByRole("heading", { name: "960 faltantes" });
    selectSection("México");

    expect(screen.getByText("Ese filtro no tiene figuritas faltantes.")).toBeTruthy();
  });

  it("links each section to album navigation", async () => {
    render(<CollectionViews mode="missing" createRepository={() => fakeRepository(createEmptyCollection())} />);

    await screen.findByRole("heading", { name: "980 faltantes" });
    const mexicoCard = screen.getByRole("heading", { name: "México" }).closest("article");

    expect(
      within(mexicoCard ?? document.body)
        .getByRole("link", { name: "Ver en álbum" })
        .getAttribute("href"),
    ).toBe("/album?section=M%C3%A9xico");
  });
});

describe("CollectionViews duplicates", () => {
  it("shows loading before resolving the collection", () => {
    render(
      <CollectionViews
        mode="duplicates"
        createRepository={() => ({
          load: () => new Promise<CollectionState>(() => undefined),
          save: async () => undefined,
          clear: async () => undefined,
        })}
      />,
    );

    expect(screen.getByText("Calculando repetidas...")).toBeTruthy();
  });

  it("shows load error and retries", async () => {
    const load = vi
      .fn<() => Promise<CollectionState>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(createEmptyCollection());
    const repository: CollectionRepository = {
      load,
      save: async () => undefined,
      clear: async () => undefined,
    };

    render(<CollectionViews mode="duplicates" createRepository={() => repository} />);

    expect(await screen.findByText("No fue posible cargar repetidas")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("No tenés figuritas repetidas.")).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shows a clear empty state without duplicates", async () => {
    render(<CollectionViews mode="duplicates" createRepository={() => fakeRepository(createEmptyCollection())} />);

    expect(await screen.findByRole("heading", { name: "0 copias repetidas" })).toBeTruthy();
    expect(screen.getByText("0 posiciones con repetidas")).toBeTruthy();
    expect(screen.getByText("No tenés figuritas repetidas.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Compartir PDF" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Copiar como texto" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Copiar repetidas" })).toBeNull();
  });

  it("shows one duplicate position and distinguishes copies from positions", async () => {
    const collection = setCopies(createEmptyCollection(), argentina7, 4);

    render(<CollectionViews mode="duplicates" createRepository={() => fakeRepository(collection)} />);

    expect(await screen.findByRole("heading", { name: "3 copias repetidas" })).toBeTruthy();
    expect(screen.getByText("1 posiciones con repetidas")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Argentina" })).toBeTruthy();
    expect(screen.getByText("1 posiciones · 3 copias repetidas")).toBeTruthy();
    expect(screen.getByText("Argentina 7")).toBeTruthy();
    expect(screen.getByText("4 copias totales · 3 repetidas")).toBeTruthy();
  });

  it("shows several duplicate positions grouped in canonical order", async () => {
    const collection = setCopies(
      setCopies(
        setCopies(setCopies(createEmptyCollection(), panama20, 3), argentina18, 2),
        mexico2,
        4,
      ),
      mexico12,
      2,
    );

    render(<CollectionViews mode="duplicates" createRepository={() => fakeRepository(collection)} />);

    expect(await screen.findByRole("heading", { name: "7 copias repetidas" })).toBeTruthy();
    expect(screen.getByText("4 posiciones con repetidas")).toBeTruthy();
    const headings = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["México", "Argentina", "Panamá"]);
    expect(screen.getByText("2 posiciones · 4 copias repetidas")).toBeTruthy();
  });

  it("copies the complete duplicate list text from the loaded collection after filtering", async () => {
    const loadedCollection = setCopies(
      setCopies(setCopies(createEmptyCollection(), mexico2, 4), argentina7, 2),
      argentina18,
      3,
    );
    const beforeCopy = collectionSnapshot(loadedCollection);
    const load = vi.fn<() => Promise<CollectionState>>().mockResolvedValue(
      loadedCollection,
    );
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const repository: CollectionRepository = {
      load,
      save,
      clear: vi.fn<CollectionRepository["clear"]>().mockResolvedValue(undefined),
    };
    const copyText = vi
      .fn<(text: string) => Promise<CopyTextResult>>()
      .mockResolvedValue({ status: "copied" });

    render(
      <CollectionViews
        mode="duplicates"
        createRepository={() => repository}
        copyText={copyText}
      />,
    );

    await screen.findByRole("heading", { name: "6 copias repetidas" });
    selectSection("Argentina");
    fireEvent.click(screen.getByRole("button", { name: "Copiar repetidas" }));

    expect(await waitForMockCall(copyText)).toBeTruthy();
    expect(copyText).toHaveBeenCalledWith(
      [
        "Tengo estas figuritas repetidas para cambiar:",
        "",
        "Grupo A",
        "México: 2 (x3)",
        "",
        "Grupo J",
        "Argentina: 7, 18 (x2)",
      ].join("\n"),
    );
    expect(
      await screen.findByText(
        "Lista de repetidas copiada. Ya podés pegarla en WhatsApp.",
      ),
    ).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(collectionSnapshot(loadedCollection)).toEqual(beforeCopy);
  });

  it("disables only duplicate copy execution while copying", async () => {
    const resolveCopyRef: {
      current: ((value: CopyTextResult | PromiseLike<CopyTextResult>) => void) | null;
    } = { current: null };
    const copyText = vi.fn(
      () =>
        new Promise<CopyTextResult>((resolve) => {
          resolveCopyRef.current = resolve;
        }),
    );
    const collection = setCopies(createEmptyCollection(), argentina7, 2);

    render(
      <CollectionViews
        mode="duplicates"
        createRepository={() => fakeRepository(collection)}
        copyText={copyText}
      />,
    );

    await screen.findByRole("heading", { name: "1 copias repetidas" });
    const copyButton = screen.getByRole("button", {
      name: "Copiar repetidas",
    }) as HTMLButtonElement;

    fireEvent.click(copyButton);

    expect(await screen.findByRole("button", { name: "Copiando…" })).toBeTruthy();
    expect(copyButton.disabled).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Registrar entrega de una repetida de Argentina 7",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    fireEvent.click(copyButton);
    expect(copyText).toHaveBeenCalledTimes(1);

    if (!resolveCopyRef.current) {
      throw new Error("Copy promise was not started.");
    }

    resolveCopyRef.current({ status: "copied" });

    expect(await screen.findByRole("button", { name: "Copiar repetidas" })).toBeTruthy();
  });

  it("shows manual copy text when duplicate clipboard fallback cannot copy", async () => {
    const collection = setCopies(createEmptyCollection(), argentina7, 2);

    render(
      <CollectionViews
        mode="duplicates"
        createRepository={() => fakeRepository(collection)}
        copyText={async () => ({ status: "manual", text: "Argentina: 7" })}
      />,
    );

    await screen.findByRole("heading", { name: "1 copias repetidas" });
    fireEvent.click(screen.getByRole("button", { name: "Copiar repetidas" }));

    expect(
      await screen.findByText(
        "No se pudo copiar automáticamente. Seleccioná el texto y copiá.",
      ),
    ).toBeTruthy();
    expect(screen.getByDisplayValue("Argentina: 7")).toBeTruthy();
  });

  it("shows a retryable error when copying duplicate text fails", async () => {
    const copyText = vi
      .fn<(text: string) => Promise<CopyTextResult>>()
      .mockRejectedValueOnce(new Error("clipboard"))
      .mockResolvedValueOnce({ status: "copied" });
    const collection = setCopies(createEmptyCollection(), argentina7, 2);

    render(
      <CollectionViews
        mode="duplicates"
        createRepository={() => fakeRepository(collection)}
        copyText={copyText}
      />,
    );

    await screen.findByRole("heading", { name: "1 copias repetidas" });
    fireEvent.click(screen.getByRole("button", { name: "Copiar repetidas" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "No se pudo copiar la lista de repetidas.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Copiar repetidas" }));
    expect(await waitForMockCallCount(copyText, 2)).toBeTruthy();
    expect(
      await screen.findByText(
        "Lista de repetidas copiada. Ya podés pegarla en WhatsApp.",
      ),
    ).toBeTruthy();
  });

  it("filters duplicates by section without reloading", async () => {
    const load = vi.fn<() => Promise<CollectionState>>().mockResolvedValue(
      setCopies(
        setCopies(createEmptyCollection(), mexico2, 4),
        argentina7,
        2,
      ),
    );
    const repository: CollectionRepository = {
      load,
      save: vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined),
      clear: vi.fn<CollectionRepository["clear"]>().mockResolvedValue(undefined),
    };

    render(<CollectionViews mode="duplicates" createRepository={() => repository} />);

    await screen.findByRole("heading", { name: "4 copias repetidas" });
    selectSection("Argentina");

    expect(screen.getByRole("heading", { name: "Argentina" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "México" })).toBeNull();
    expect(screen.getByText("Filtro activo: Argentina")).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("shows filter empty state when the selected section has no duplicates", async () => {
    const collection = setCopies(createEmptyCollection(), argentina7, 2);

    render(<CollectionViews mode="duplicates" createRepository={() => fakeRepository(collection)} />);

    await screen.findByRole("heading", { name: "1 copias repetidas" });
    selectSection("México");

    expect(screen.getByText("Ese filtro no tiene figuritas repetidas.")).toBeTruthy();
  });

  it("links duplicate sections to album navigation", async () => {
    const collection = setCopies(createEmptyCollection(), argentina7, 2);

    render(<CollectionViews mode="duplicates" createRepository={() => fakeRepository(collection)} />);

    await screen.findByRole("heading", { name: "1 copias repetidas" });
    const argentinaCard = screen.getByRole("heading", { name: "Argentina" }).closest("article");

    expect(
      within(argentinaCard ?? document.body)
        .getByRole("link", { name: "Ver en álbum" })
        .getAttribute("href"),
    ).toBe("/album?section=Argentina");
  });

  it("registers one delivered duplicate and persists the resulting collection", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const collection = setCopies(createEmptyCollection(), argentina7, 3);

    render(
      <CollectionViews
        mode="duplicates"
        createRepository={() => fakeRepository(collection, save)}
      />,
    );

    expect(await screen.findByRole("heading", { name: "2 copias repetidas" })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Registrar entrega de una repetida de Argentina 7",
      }),
    );

    expect(await screen.findByText("Argentina 7 actualizada.")).toBeTruthy();
    expect(screen.getByText("Ahora tenés 2 copias y 1 repetida.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "1 copias repetidas" })).toBeTruthy();
    expect(screen.getByText("2 copias totales · 1 repetidas")).toBeTruthy();
    expect(save).toHaveBeenCalledTimes(1);
    expect(getCopies(save.mock.calls[0][0], argentina7)).toBe(2);
  });

  it("updates copied duplicate text after deliver, undo and quantity correction", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const copyText = vi
      .fn<(text: string) => Promise<CopyTextResult>>()
      .mockResolvedValue({ status: "copied" });
    const collection = setCopies(createEmptyCollection(), argentina7, 3);

    render(
      <CollectionViews
        mode="duplicates"
        createRepository={() => fakeRepository(collection, save)}
        copyText={copyText}
      />,
    );

    await screen.findByRole("heading", { name: "2 copias repetidas" });
    fireEvent.click(screen.getByRole("button", { name: "Copiar repetidas" }));
    expect(await waitForMockCallCount(copyText, 1)).toBeTruthy();
    expect(copyText.mock.calls[0][0]).toContain("Argentina: 7 (x2)");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Registrar entrega de una repetida de Argentina 7",
      }),
    );
    expect(await screen.findByText("Argentina 7 actualizada.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copiar repetidas" }));
    expect(await waitForMockCallCount(copyText, 2)).toBeTruthy();
    expect(copyText.mock.calls[1][0]).toContain("Argentina: 7");
    expect(copyText.mock.calls[1][0]).not.toContain("(x1)");

    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(await screen.findByText("Cambio deshecho.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copiar repetidas" }));
    expect(await waitForMockCallCount(copyText, 3)).toBeTruthy();
    expect(copyText.mock.calls[2][0]).toContain("Argentina: 7 (x2)");

    openQuantityEditor("Argentina 7");
    fireEvent.change(screen.getByLabelText("Cantidad total registrada"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cantidad" }));
    expect(await screen.findByText("Argentina 7 corregida.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copiar repetidas" }));
    expect(await waitForMockCallCount(copyText, 4)).toBeTruthy();
    expect(copyText.mock.calls[3][0]).toContain("Argentina: 7 (x3)");
    expect(save).toHaveBeenCalledTimes(3);
  });

  it("removes the position from duplicates when delivering leaves one copy", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const collection = setCopies(createEmptyCollection(), argentina7, 2);

    render(
      <CollectionViews
        mode="duplicates"
        createRepository={() => fakeRepository(collection, save)}
      />,
    );

    expect(await screen.findByRole("heading", { name: "1 copias repetidas" })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Registrar entrega de una repetida de Argentina 7",
      }),
    );

    expect(await screen.findByText("Ahora tenés 1 copia y ninguna repetida.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "0 copias repetidas" })).toBeTruthy();
    expect(screen.getByText("No tenés figuritas repetidas.")).toBeTruthy();
    expect(screen.queryByText("Argentina 7")).toBeNull();
    expect(screen.queryByRole("button", { name: "Copiar repetidas" })).toBeNull();
    expect(getCopies(save.mock.calls[0][0], argentina7)).toBe(1);
  });

  it("blocks duplicate delivery while a save is pending", async () => {
    const resolveSaveRef: { current: (() => void) | null } = { current: null };
    const save = vi.fn<CollectionRepository["save"]>(
      () =>
        new Promise<void>((resolve) => {
          resolveSaveRef.current = resolve;
        }),
    );
    const collection = setCopies(createEmptyCollection(), argentina7, 3);

    render(
      <CollectionViews
        mode="duplicates"
        createRepository={() => fakeRepository(collection, save)}
      />,
    );

    await screen.findByRole("heading", { name: "2 copias repetidas" });
    const deliverButton = screen.getByRole("button", {
      name: "Registrar entrega de una repetida de Argentina 7",
    }) as HTMLButtonElement;

    fireEvent.click(deliverButton);

    expect(await screen.findByText("Guardando cambios...")).toBeTruthy();
    expect(deliverButton.disabled).toBe(true);
    fireEvent.click(deliverButton);
    expect(save).toHaveBeenCalledTimes(1);

    if (!resolveSaveRef.current) {
      throw new Error("Save promise was not started.");
    }

    resolveSaveRef.current();
    expect(await screen.findByText("Argentina 7 actualizada.")).toBeTruthy();
  });

  it("rolls back duplicate delivery when saving fails and allows retry", async () => {
    const save = vi
      .fn<CollectionRepository["save"]>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);
    const collection = setCopies(createEmptyCollection(), argentina7, 2);

    render(
      <CollectionViews
        mode="duplicates"
        createRepository={() => fakeRepository(collection, save)}
      />,
    );

    await screen.findByRole("heading", { name: "1 copias repetidas" });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Registrar entrega de una repetida de Argentina 7",
      }),
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "No fue posible registrar la entrega de Argentina 7.",
    );
    expect(screen.getByRole("heading", { name: "1 copias repetidas" })).toBeTruthy();
    expect(screen.getByText("2 copias totales · 1 repetidas")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Registrar entrega de una repetida de Argentina 7",
      }),
    );

    expect(await screen.findByText("Ahora tenés 1 copia y ninguna repetida.")).toBeTruthy();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("undoes only the last delivered duplicate", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const collection = setCopies(createEmptyCollection(), argentina7, 2);

    render(
      <CollectionViews
        mode="duplicates"
        createRepository={() => fakeRepository(collection, save)}
      />,
    );

    await screen.findByRole("heading", { name: "1 copias repetidas" });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Registrar entrega de una repetida de Argentina 7",
      }),
    );
    expect(await screen.findByText("Ahora tenés 1 copia y ninguna repetida.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));

    expect(await screen.findByText("Cambio deshecho.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "1 copias repetidas" })).toBeTruthy();
    expect(screen.getByText("2 copias totales · 1 repetidas")).toBeTruthy();
    expect(save).toHaveBeenCalledTimes(2);
    expect(getCopies(save.mock.calls[1][0], argentina7)).toBe(2);
  });

  it("keeps the delivered state when undo fails", async () => {
    const save = vi
      .fn<CollectionRepository["save"]>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("boom"));
    const collection = setCopies(createEmptyCollection(), argentina7, 2);

    render(
      <CollectionViews
        mode="duplicates"
        createRepository={() => fakeRepository(collection, save)}
      />,
    );

    await screen.findByRole("heading", { name: "1 copias repetidas" });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Registrar entrega de una repetida de Argentina 7",
      }),
    );
    expect(await screen.findByText("Ahora tenés 1 copia y ninguna repetida.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "No fue posible deshacer el último cambio.",
    );
    expect(screen.getByRole("heading", { name: "0 copias repetidas" })).toBeTruthy();
    expect(screen.getByText("No tenés figuritas repetidas.")).toBeTruthy();
  });

  it("opens and cancels the quantity editor", async () => {
    const collection = setCopies(createEmptyCollection(), argentina7, 3);

    render(<CollectionViews mode="duplicates" createRepository={() => fakeRepository(collection)} />);

    await screen.findByRole("heading", { name: "2 copias repetidas" });
    fireEvent.click(
      screen.getByRole("button", { name: "Corregir cantidad de Argentina 7" }),
    );

    expect(
      (screen.getByLabelText("Cantidad total registrada") as HTMLInputElement).value,
    ).toBe("3");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByLabelText("Cantidad total registrada")).toBeNull();
    expect(screen.getByRole("heading", { name: "2 copias repetidas" })).toBeTruthy();
  });

  it("corrects duplicate quantity to two and persists it", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const collection = setCopies(createEmptyCollection(), argentina7, 3);

    render(
      <CollectionViews
        mode="duplicates"
        createRepository={() => fakeRepository(collection, save)}
      />,
    );

    await screen.findByRole("heading", { name: "2 copias repetidas" });
    openQuantityEditor("Argentina 7");
    fireEvent.change(screen.getByLabelText("Cantidad total registrada"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cantidad" }));

    expect(await screen.findByText("Argentina 7 corregida.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "1 copias repetidas" })).toBeTruthy();
    expect(getCopies(save.mock.calls[0][0], argentina7)).toBe(2);
  });

  it("corrects duplicate quantity to one and removes it from duplicates", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const collection = setCopies(createEmptyCollection(), argentina7, 2);

    render(
      <CollectionViews
        mode="duplicates"
        createRepository={() => fakeRepository(collection, save)}
      />,
    );

    await screen.findByRole("heading", { name: "1 copias repetidas" });
    openQuantityEditor("Argentina 7");
    fireEvent.change(screen.getByLabelText("Cantidad total registrada"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cantidad" }));

    expect(await screen.findByText("Ahora tenés 1 copia y ninguna repetida.")).toBeTruthy();
    expect(screen.getByText("No tenés figuritas repetidas.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Copiar repetidas" })).toBeNull();
    expect(getCopies(save.mock.calls[0][0], argentina7)).toBe(1);
  });

  it("warns before saving zero and marks the position as missing", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const collection = setCopies(createEmptyCollection(), argentina7, 2);

    render(
      <CollectionViews
        mode="duplicates"
        createRepository={() => fakeRepository(collection, save)}
      />,
    );

    await screen.findByRole("heading", { name: "1 copias repetidas" });
    openQuantityEditor("Argentina 7");
    fireEvent.change(screen.getByLabelText("Cantidad total registrada"), {
      target: { value: "0" },
    });

    expect(
      screen.getByText("Esta figurita quedará marcada como faltante."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Guardar cantidad" }));

    expect(await screen.findByText("Ahora figura como faltante.")).toBeTruthy();
    expect(getCopies(save.mock.calls[0][0], argentina7)).toBe(0);
  });

  it("increases quantity from the editor and persists it", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const collection = setCopies(createEmptyCollection(), argentina7, 2);

    render(
      <CollectionViews
        mode="duplicates"
        createRepository={() => fakeRepository(collection, save)}
      />,
    );

    await screen.findByRole("heading", { name: "1 copias repetidas" });
    openQuantityEditor("Argentina 7");
    fireEvent.click(
      screen.getByRole("button", { name: "Aumentar cantidad de Argentina 7" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar cantidad" }));

    expect(await screen.findByText("Ahora tenés 3 copias y 2 repetidas.")).toBeTruthy();
    expect(getCopies(save.mock.calls[0][0], argentina7)).toBe(3);
  });

  it("rejects negative, decimal and text quantities before saving", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const collection = setCopies(createEmptyCollection(), argentina7, 2);

    render(
      <CollectionViews
        mode="duplicates"
        createRepository={() => fakeRepository(collection, save)}
      />,
    );

    await screen.findByRole("heading", { name: "1 copias repetidas" });
    openQuantityEditor("Argentina 7");

    for (const value of ["-1", "1.5", "abc"]) {
      fireEvent.change(screen.getByLabelText("Cantidad total registrada"), {
        target: { value },
      });

      expect(screen.getByRole("alert").textContent).toContain(
        "Ingresá una cantidad entera sin decimales.",
      );
      expect(
        (screen.getByRole("button", { name: "Guardar cantidad" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    }

    expect(save).not.toHaveBeenCalled();
  });

  it("rolls back quantity correction when saving fails", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockRejectedValue(new Error("boom"));
    const collection = setCopies(createEmptyCollection(), argentina7, 3);

    render(
      <CollectionViews
        mode="duplicates"
        createRepository={() => fakeRepository(collection, save)}
      />,
    );

    await screen.findByRole("heading", { name: "2 copias repetidas" });
    openQuantityEditor("Argentina 7");
    fireEvent.change(screen.getByLabelText("Cantidad total registrada"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cantidad" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "No fue posible corregir la cantidad de Argentina 7.",
    );
    expect(screen.getByRole("heading", { name: "2 copias repetidas" })).toBeTruthy();
    expect(screen.getByText("3 copias totales · 2 repetidas")).toBeTruthy();
  });
});

function fakeRepository(
  collection: CollectionState,
  save: CollectionRepository["save"] = async () => undefined,
): CollectionRepository {
  return {
    load: async () => collection,
    save,
    clear: async () => undefined,
  };
}

function selectSection(section: string): void {
  fireEvent.change(screen.getByLabelText(/Filtrar/), {
    target: { value: section },
  });
}

function openQuantityEditor(positionLabel: string): void {
  fireEvent.click(
    screen.getByRole("button", { name: `Corregir cantidad de ${positionLabel}` }),
  );
}

async function waitForMockCall<T extends (...args: never[]) => unknown>(
  mock: ReturnType<typeof vi.fn<T>>,
): Promise<boolean> {
  return waitForMockCallCount(mock, 1);
}

async function waitForMockCallCount<T extends (...args: never[]) => unknown>(
  mock: ReturnType<typeof vi.fn<T>>,
  count: number,
): Promise<boolean> {
  await waitFor(() => {
    expect(mock).toHaveBeenCalledTimes(count);
  });
  return true;
}

function collectionSnapshot(collection: CollectionState): CollectionState {
  return {
    copiesByPosition: { ...collection.copiesByPosition },
  };
}
