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
import {
  createEmptyCollection,
  getCopies,
  setCopies,
  type CollectionState,
} from "../../../domain/collection/collection";
import type { CollectionRepository } from "../../../infrastructure/persistence/collection-repository";
import { AlbumBrowser } from "./album-browser";

const panini = { section: "PANINI", position: "00" };
const fwc4 = { section: "FWC", position: "4" };
const mexico1 = { section: "México", position: "1" };
const mexico12 = { section: "México", position: "12" };
const argentina7 = { section: "Argentina", position: "7" };
const argentina18 = { section: "Argentina", position: "18" };

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

describe("AlbumBrowser", () => {
  it("shows a loading state before resolving", () => {
    render(
      <AlbumBrowser
        createRepository={() => ({
          load: () => new Promise<CollectionState>(() => undefined),
          save: async () => undefined,
          clear: async () => undefined,
        })}
      />,
    );

    expect(screen.getByText("Cargando álbum")).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 2, name: "PANINI" })).toBeNull();
  });

  it("shows an error and retries successfully", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const load = vi
      .fn<() => Promise<CollectionState>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(createEmptyCollection());
    const repository: CollectionRepository = {
      load,
      save: async () => undefined,
      clear: async () => undefined,
    };

    render(<AlbumBrowser createRepository={() => repository} />);

    expect(await screen.findByText("No fue posible cargar el álbum")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("heading", { level: 2, name: "PANINI" })).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("starts at PANINI with an empty collection", async () => {
    render(<AlbumBrowser createRepository={() => fakeRepository(createEmptyCollection())} />);

    expect(await screen.findByRole("heading", { level: 2, name: "PANINI" })).toBeTruthy();
    expect(screen.getByText("Especiales")).toBeTruthy();
    expect(screen.getByText("0 de 1 pegadas · 1 faltantes · 0 repetidas")).toBeTruthy();
    expect(screen.getByText("0% de esta sección")).toBeTruthy();
    expect((screen.getByLabelText("Sección del álbum") as HTMLSelectElement).value).toBe(
      "PANINI",
    );
    expect(screen.getByLabelText("PANINI 00: Faltante, 0 copias")).toBeTruthy();
  });

  it("shows PANINI as owned and repeated when the collection has copies", async () => {
    const collection = setCopies(createEmptyCollection(), panini, 3);

    render(<AlbumBrowser createRepository={() => fakeRepository(collection)} />);

    expect(await screen.findByRole("heading", { level: 2, name: "PANINI" })).toBeTruthy();
    expect(screen.getByText("1 de 1 pegadas · 0 faltantes · 2 repetidas")).toBeTruthy();
    expect(screen.getByLabelText("PANINI 00: 2 repetidas, 3 copias")).toBeTruthy();
    expect(screen.getByText("2 repetidas")).toBeTruthy();
  });

  it("navigates to FWC and shows its 19 positions", async () => {
    const collection = setCopies(createEmptyCollection(), fwc4, 1);

    render(<AlbumBrowser createRepository={() => fakeRepository(collection)} />);

    await screen.findByRole("heading", { level: 2, name: "PANINI" });
    selectSection("FWC");

    expect(screen.getByRole("heading", { level: 2, name: "FWC" })).toBeTruthy();
    expect(screen.getByText("1 de 19 pegadas · 18 faltantes · 0 repetidas")).toBeTruthy();
    expect(screen.getByLabelText("FWC 4: Pegada, 1 copia")).toBeTruthy();
    expect(screen.getByLabelText("FWC 19: Faltante, 0 copias")).toBeTruthy();
    expect(positionCards()).toHaveLength(19);
  });

  it("opens a valid initial section from navigation", async () => {
    render(
      <AlbumBrowser
        createRepository={() => fakeRepository(createEmptyCollection())}
        initialSection="Argentina"
      />,
    );

    expect(await screen.findByRole("heading", { level: 2, name: "Argentina" })).toBeTruthy();
    expect((screen.getByLabelText("Sección del álbum") as HTMLSelectElement).value).toBe(
      "Argentina",
    );
  });

  it("opens PANINI when the initial section is invalid", async () => {
    render(
      <AlbumBrowser
        createRepository={() => fakeRepository(createEmptyCollection())}
        initialSection="Italia"
      />,
    );

    expect(await screen.findByRole("heading", { level: 2, name: "PANINI" })).toBeTruthy();
    expect((screen.getByLabelText("Sección del álbum") as HTMLSelectElement).value).toBe(
      "PANINI",
    );
  });

  it("opens PANINI, FWC and names with spaces or accents from initial section", async () => {
    const first = render(
      <AlbumBrowser
        createRepository={() => fakeRepository(createEmptyCollection())}
        initialSection="FWC"
      />,
    );

    expect(await screen.findByRole("heading", { level: 2, name: "FWC" })).toBeTruthy();
    first.unmount();

    const second = render(
      <AlbumBrowser
        createRepository={() => fakeRepository(createEmptyCollection())}
        initialSection="Corea del Sur"
      />,
    );
    expect(await screen.findByRole("heading", { level: 2, name: "Corea del Sur" })).toBeTruthy();
    second.unmount();

    render(
      <AlbumBrowser
        createRepository={() => fakeRepository(createEmptyCollection())}
        initialSection="Mexico"
      />,
    );

    expect(await screen.findByRole("heading", { level: 2, name: "México" })).toBeTruthy();
  });

  it("uses the visible query string when a cached shell is served for a section URL", async () => {
    window.history.replaceState(
      null,
      "",
      "/album?section=Rep%C3%BAblica%20Democr%C3%A1tica%20del%20Congo",
    );

    render(
      <AlbumBrowser
        createRepository={() => fakeRepository(createEmptyCollection())}
        initialSection="PANINI"
      />,
    );

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "República Democrática del Congo",
      }),
    ).toBeTruthy();
    expect((screen.getByLabelText("Sección del álbum") as HTMLSelectElement).value).toBe(
      "República Democrática del Congo",
    );
  });

  it("falls back to PANINI when the visible query section is invalid", async () => {
    window.history.replaceState(null, "", "/album?section=Italia");

    render(
      <AlbumBrowser
        createRepository={() => fakeRepository(createEmptyCollection())}
        initialSection="PANINI"
      />,
    );

    expect(await screen.findByRole("heading", { level: 2, name: "PANINI" })).toBeTruthy();
  });

  it("navigates to a selection and shows its 20 positions", async () => {
    const collection = setCopies(createEmptyCollection(), mexico12, 1);

    render(<AlbumBrowser createRepository={() => fakeRepository(collection)} />);

    await screen.findByRole("heading", { level: 2, name: "PANINI" });
    selectSection("México");

    expect(screen.getByRole("heading", { level: 2, name: "México" })).toBeTruthy();
    expect(screen.getByText("Grupo A")).toBeTruthy();
    expect(screen.getByText("1 de 20 pegadas · 19 faltantes · 0 repetidas")).toBeTruthy();
    expect(screen.getByLabelText("México 12: Pegada, 1 copia")).toBeTruthy();
    expect(screen.getByLabelText("México 1: Faltante, 0 copias")).toBeTruthy();
    expect(positionCards()).toHaveLength(20);
  });

  it("navigates between groups", async () => {
    render(<AlbumBrowser createRepository={() => fakeRepository(createEmptyCollection())} />);

    await screen.findByRole("heading", { level: 2, name: "PANINI" });
    selectSection("México");
    expect(screen.getByText("Grupo A")).toBeTruthy();

    selectSection("Argentina");
    expect(screen.getByRole("heading", { level: 2, name: "Argentina" })).toBeTruthy();
    expect(screen.getByText("Grupo J")).toBeTruthy();
  });

  it("shows missing, owned and repeated position states", async () => {
    const collection = setCopies(
      setCopies(createEmptyCollection(), argentina7, 1),
      argentina18,
      3,
    );

    render(<AlbumBrowser createRepository={() => fakeRepository(collection)} />);

    await screen.findByRole("heading", { level: 2, name: "PANINI" });
    selectSection("Argentina");

    expect(screen.getByText("2 de 20 pegadas · 18 faltantes · 2 repetidas")).toBeTruthy();
    expect(screen.getByLabelText("Argentina 1: Faltante, 0 copias")).toBeTruthy();
    expect(screen.getByLabelText("Argentina 7: Pegada, 1 copia")).toBeTruthy();
    expect(screen.getByLabelText("Argentina 18: 2 repetidas, 3 copias")).toBeTruthy();
    expect(screen.getByText("2 repetidas")).toBeTruthy();
  });

  it("keeps each editable position as a self-contained card", async () => {
    const collection = setCopies(
      setCopies(createEmptyCollection(), mexico1, 1),
      mexico12,
      3,
    );

    render(<AlbumBrowser createRepository={() => fakeRepository(collection)} />);

    await screen.findByRole("heading", { level: 2, name: "PANINI" });
    selectSection("México");

    const missingCard = screen.getByRole("article", {
      name: "México 2: Faltante, 0 copias",
    });
    const ownedCard = screen.getByRole("article", {
      name: "México 1: Pegada, 1 copia",
    });
    const duplicateCard = screen.getByRole("article", {
      name: "México 12: 2 repetidas, 3 copias",
    });

    expect(within(missingCard).getByText("Faltante")).toBeTruthy();
    expect(within(missingCard).getAllByText("Faltante")).toHaveLength(1);
    expect(missingCard.textContent).toContain("Cantidad: 0");
    expect(within(missingCard).getByLabelText("0 copias registradas")).toBeTruthy();
    expect(
      (
        within(missingCard).getByRole("button", {
          name: "Quitar copia de México 2",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      within(missingCard).getByRole("button", { name: "Agregar copia de México 2" }),
    ).toBeTruthy();

    expect(within(ownedCard).getByText("Pegada")).toBeTruthy();
    expect(ownedCard.textContent).toContain("Cantidad: 1");
    expect(within(ownedCard).getByLabelText("1 copia registrada")).toBeTruthy();
    expect(
      within(ownedCard).getByRole("button", { name: "Quitar copia de México 1" }),
    ).toBeTruthy();
    expect(
      within(ownedCard).getByRole("button", { name: "Agregar copia de México 1" }),
    ).toBeTruthy();

    expect(within(duplicateCard).getByText("2 repetidas")).toBeTruthy();
    expect(duplicateCard.textContent).toContain("Cantidad: 3");
    expect(within(duplicateCard).getByLabelText("3 copias registradas")).toBeTruthy();
    expect(
      within(duplicateCard).getByRole("button", {
        name: "Quitar copia de México 12",
      }),
    ).toBeTruthy();
    expect(
      within(duplicateCard).getByRole("button", {
        name: "Agregar copia de México 12",
      }),
    ).toBeTruthy();
  });

  it("keeps the loaded collection without additional reads while navigating", async () => {
    const load = vi.fn<() => Promise<CollectionState>>().mockResolvedValue(
      setCopies(createEmptyCollection(), mexico1, 1),
    );
    const repository: CollectionRepository = {
      load,
      save: vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined),
      clear: vi.fn<CollectionRepository["clear"]>().mockResolvedValue(undefined),
    };

    render(<AlbumBrowser createRepository={() => repository} />);

    await screen.findByRole("heading", { level: 2, name: "PANINI" });
    selectSection("México");
    selectSection("Argentina");

    expect(load).toHaveBeenCalledTimes(1);
    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.clear).not.toHaveBeenCalled();
  });

  it("adds one copy from zero and saves the resulting collection", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const repository = fakeRepository(createEmptyCollection(), save);

    render(<AlbumBrowser createRepository={() => repository} />);

    await screen.findByRole("heading", { level: 2, name: "PANINI" });
    fireEvent.click(screen.getByRole("button", { name: "Agregar copia de PANINI 00" }));

    expect(await screen.findByText("Cambios guardados.")).toBeTruthy();
    expect(screen.getByLabelText("PANINI 00: Pegada, 1 copia")).toBeTruthy();
    expect(screen.getByText("1 de 1 pegadas · 0 faltantes · 0 repetidas")).toBeTruthy();
    expect(save).toHaveBeenCalledTimes(1);
    expect(getCopies(save.mock.calls[0][0], panini)).toBe(1);
  });

  it("adds up to several copies and shows repeated state", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const repository = fakeRepository(createEmptyCollection(), save);

    render(<AlbumBrowser createRepository={() => repository} />);

    await screen.findByRole("heading", { level: 2, name: "PANINI" });
    await addPaniniCopy();
    await addPaniniCopy();
    await addPaniniCopy();

    expect(screen.getByLabelText("PANINI 00: 2 repetidas, 3 copias")).toBeTruthy();
    expect(screen.getByText("1 de 1 pegadas · 0 faltantes · 2 repetidas")).toBeTruthy();
    expect(save).toHaveBeenCalledTimes(3);
    expect(getCopies(save.mock.calls[2][0], panini)).toBe(3);
  });

  it("removes one copy and saves the change", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const repository = fakeRepository(setCopies(createEmptyCollection(), panini, 2), save);

    render(<AlbumBrowser createRepository={() => repository} />);

    await screen.findByRole("heading", { level: 2, name: "PANINI" });
    fireEvent.click(screen.getByRole("button", { name: "Quitar copia de PANINI 00" }));

    expect(await screen.findByText("Cambios guardados.")).toBeTruthy();
    expect(screen.getByLabelText("PANINI 00: Pegada, 1 copia")).toBeTruthy();
    expect(getCopies(save.mock.calls[0][0], panini)).toBe(1);
  });

  it("removes the last copy and returns to missing state", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const repository = fakeRepository(setCopies(createEmptyCollection(), panini, 1), save);

    render(<AlbumBrowser createRepository={() => repository} />);

    await screen.findByRole("heading", { level: 2, name: "PANINI" });
    fireEvent.click(screen.getByRole("button", { name: "Quitar copia de PANINI 00" }));

    expect(await screen.findByText("Cambios guardados.")).toBeTruthy();
    expect(screen.getByLabelText("PANINI 00: Faltante, 0 copias")).toBeTruthy();
    expect(screen.getByText("0 de 1 pegadas · 1 faltantes · 0 repetidas")).toBeTruthy();
    expect(getCopies(save.mock.calls[0][0], panini)).toBe(0);
  });

  it("disables remove when quantity is zero", async () => {
    render(<AlbumBrowser createRepository={() => fakeRepository(createEmptyCollection())} />);

    await screen.findByRole("heading", { level: 2, name: "PANINI" });

    expect(
      (screen.getByRole("button", {
        name: "Quitar copia de PANINI 00",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("updates section metrics when editing a selection", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const repository = fakeRepository(createEmptyCollection(), save);

    render(<AlbumBrowser createRepository={() => repository} />);

    await screen.findByRole("heading", { level: 2, name: "PANINI" });
    selectSection("Argentina");
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar copia de Argentina 7" }),
    );
    expect(await screen.findByText("Cambios guardados.")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar copia de Argentina 18" }),
    );
    expect(await screen.findByText("Cambios guardados.")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar copia de Argentina 18" }),
    );

    expect(await screen.findByText("2 de 20 pegadas · 18 faltantes · 1 repetidas")).toBeTruthy();
    expect(screen.getByLabelText("Argentina 18: 1 repetida, 2 copias")).toBeTruthy();
  });

  it("does not lose consecutive changes made after each save completes", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const repository = fakeRepository(createEmptyCollection(), save);

    render(<AlbumBrowser createRepository={() => repository} />);

    await screen.findByRole("heading", { level: 2, name: "PANINI" });
    await addPaniniCopy();
    await addPaniniCopy();

    expect(screen.getByLabelText("PANINI 00: 1 repetida, 2 copias")).toBeTruthy();
    expect(save).toHaveBeenCalledTimes(2);
    expect(getCopies(save.mock.calls[1][0], panini)).toBe(2);
  });

  it("blocks controls while a save is pending", async () => {
    let resolveSave: (() => void) | null = null;
    const save = vi.fn<CollectionRepository["save"]>(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const repository = fakeRepository(createEmptyCollection(), save);

    render(<AlbumBrowser createRepository={() => repository} />);

    await screen.findByRole("heading", { level: 2, name: "PANINI" });
    fireEvent.click(screen.getByRole("button", { name: "Agregar copia de PANINI 00" }));

    expect(await screen.findByText("Guardando cambios...")).toBeTruthy();
    expect(
      (screen.getByRole("button", {
        name: "Agregar copia de PANINI 00",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);

    resolveSave?.();
    expect(await screen.findByText("Cambios guardados.")).toBeTruthy();
  });

  it("rolls back and shows an error when saving fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const save = vi.fn<CollectionRepository["save"]>().mockRejectedValue(new Error("boom"));
    const repository = fakeRepository(createEmptyCollection(), save);

    render(<AlbumBrowser createRepository={() => repository} />);

    await screen.findByRole("heading", { level: 2, name: "PANINI" });
    fireEvent.click(screen.getByRole("button", { name: "Agregar copia de PANINI 00" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(
      screen.getByText("No fue posible guardar. Se restauró el estado anterior."),
    ).toBeTruthy();
    expect(screen.getByLabelText("PANINI 00: Faltante, 0 copias")).toBeTruthy();
    expect(screen.getByText("0 de 1 pegadas · 1 faltantes · 0 repetidas")).toBeTruthy();
  });

  it("allows retrying an action after a save error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const save = vi
      .fn<CollectionRepository["save"]>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);
    const repository = fakeRepository(createEmptyCollection(), save);

    render(<AlbumBrowser createRepository={() => repository} />);

    await screen.findByRole("heading", { level: 2, name: "PANINI" });
    fireEvent.click(screen.getByRole("button", { name: "Agregar copia de PANINI 00" }));
    expect(await screen.findByText("No fue posible guardar. Se restauró el estado anterior.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Agregar copia de PANINI 00" }));

    expect(await screen.findByText("Cambios guardados.")).toBeTruthy();
    expect(screen.getByLabelText("PANINI 00: Pegada, 1 copia")).toBeTruthy();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("keeps the selected section after saving", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const repository = fakeRepository(createEmptyCollection(), save);

    render(<AlbumBrowser createRepository={() => repository} />);

    await screen.findByRole("heading", { level: 2, name: "PANINI" });
    selectSection("Argentina");
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar copia de Argentina 7" }),
    );

    expect(await screen.findByText("Cambios guardados.")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Argentina" })).toBeTruthy();
    expect(screen.getByLabelText("Argentina 7: Pegada, 1 copia")).toBeTruthy();
  });

  it("does not load again when editing quantities", async () => {
    const load = vi.fn<() => Promise<CollectionState>>().mockResolvedValue(createEmptyCollection());
    const repository: CollectionRepository = {
      load,
      save: vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined),
      clear: vi.fn<CollectionRepository["clear"]>().mockResolvedValue(undefined),
    };

    render(<AlbumBrowser createRepository={() => repository} />);

    await screen.findByRole("heading", { level: 2, name: "PANINI" });
    await addPaniniCopy();

    expect(load).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it("keeps a clear access back to the home page", async () => {
    render(<AlbumBrowser createRepository={() => fakeRepository(createEmptyCollection())} />);

    expect(
      (await screen.findByRole("link", { name: "Volver al inicio" })).getAttribute(
        "href",
      ),
    ).toBe("/");
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
  fireEvent.change(screen.getByLabelText("Sección del álbum"), {
    target: { value: section },
  });
}

function positionCards(): HTMLElement[] {
  return within(screen.getByRole("heading", { name: "Posiciones" }).parentElement ?? document.body)
    .getAllByRole("article");
}

async function addPaniniCopy(): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: "Agregar copia de PANINI 00" }));
  await waitFor(() => {
    expect(
      (screen.getByRole("button", {
        name: "Agregar copia de PANINI 00",
      }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
  expect(screen.getByText("Cambios guardados.")).toBeTruthy();
}
