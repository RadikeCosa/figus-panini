/**
 * @vitest-environment jsdom
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
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
import type { CollectionRepository } from "../../infrastructure/persistence/collection-repository";
import { CollectionDashboard } from "./collection-dashboard";
import { MainNavigation } from "./main-navigation";

const mexico1 = { section: "México", position: "1" };
const mexico2 = { section: "México", position: "2" };
const mexico15 = { section: "México", position: "15" };
const argentina7 = { section: "Argentina", position: "7" };
const panini = { section: "PANINI", position: "00" };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CollectionDashboard", () => {
  it("shows an explicit loading state before resolving", () => {
    render(
      <CollectionDashboard
        createRepository={() => ({
          load: () => new Promise<CollectionState>(() => undefined),
          save: async () => undefined,
          clear: async () => undefined,
        })}
      />,
    );

    expect(screen.getByText("Cargando colección")).toBeTruthy();
    expect(screen.queryByText("0 / 980")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Así va tu álbum" })).toBeNull();
  });

  it("shows an empty loaded collection as 0 / 980", async () => {
    render(<CollectionDashboard createRepository={() => fakeRepository(createEmptyCollection())} />);

    expect(await screen.findByText("0 / 980")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Buscá una figurita" })).toBeTruthy();
    expect(screen.getByText("0% completado")).toBeTruthy();
    expect(metricValue("Pegadas")).toBe("0");
    expect(metricValue("Faltantes")).toBe("980");
    expect(metricValue("Repetidas")).toBe("0");
    expect(screen.getByRole("heading", { name: "Así va tu álbum" })).toBeTruthy();
    expect(screen.getByText("Tu álbum está listo para empezar")).toBeTruthy();
    expect(screen.getByText("Cargá tu primera figurita.")).toBeTruthy();
  });

  it("shows a real summary with copies and duplicates", async () => {
    const collection = setCopies(
      setCopies(setCopies(createEmptyCollection(), mexico1, 3), mexico2, 1),
      panini,
      1,
    );

    render(<CollectionDashboard createRepository={() => fakeRepository(collection)} />);

    expect(await screen.findByText("3 / 980")).toBeTruthy();
    expect(screen.getByText("0% completado")).toBeTruthy();
    expect(metricValue("Pegadas")).toBe("3");
    expect(metricValue("Faltantes")).toBe("977");
    expect(metricValue("Repetidas")).toBe("2");
  });

  it("shows an error and retries successfully", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const load = vi
      .fn<() => Promise<CollectionState>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(setCopies(createEmptyCollection(), mexico1, 1));
    const repository: CollectionRepository = {
      load,
      save: async () => undefined,
      clear: async () => undefined,
    };

    render(<CollectionDashboard createRepository={() => repository} />);

    expect(await screen.findByText("No fue posible cargar la colección")).toBeTruthy();
    expect(screen.queryByText("0 / 980")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Así va tu álbum" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("1 / 980")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Así va tu álbum" })).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shows a missing position from the loaded collection", async () => {
    render(<CollectionDashboard createRepository={() => fakeRepository(createEmptyCollection())} />);

    await screen.findByText("0 / 980");
    submitLookup("Argentina 7");

    expect(await screen.findByText("Argentina 7")).toBeTruthy();
    expect(screen.getByText("No la tenés.")).toBeTruthy();
    expect(screen.getByText("0 copias.")).toBeTruthy();
  });

  it("shows a position with one copy", async () => {
    const collection = setCopies(createEmptyCollection(), argentina7, 1);

    render(<CollectionDashboard createRepository={() => fakeRepository(collection)} />);

    await screen.findByText("1 / 980");
    submitLookup("argentina 7");

    expect(await screen.findByText("Argentina 7")).toBeTruthy();
    expect(screen.getByText("La tenés.")).toBeTruthy();
    expect(screen.getByText("1 copia.")).toBeTruthy();
  });

  it("shows a repeated position", async () => {
    const collection = setCopies(createEmptyCollection(), panini, 3);

    render(<CollectionDashboard createRepository={() => fakeRepository(collection)} />);

    await screen.findByText("1 / 980");
    submitLookup("panini 00");

    expect(await screen.findByText("PANINI 00")).toBeTruthy();
    expect(screen.getByText("La tenés repetida.")).toBeTruthy();
    expect(screen.getByText("3 copias en total · 2 repetidas.")).toBeTruthy();
  });

  it("shows a section error", async () => {
    render(<CollectionDashboard createRepository={() => fakeRepository(createEmptyCollection())} />);

    await screen.findByText("0 / 980");
    submitLookup("Italia 7");

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Esa sección no existe en este álbum.",
    );
  });

  it("shows a number error", async () => {
    render(<CollectionDashboard createRepository={() => fakeRepository(createEmptyCollection())} />);

    await screen.findByText("0 / 980");
    submitLookup("FWC 20");

    expect((await screen.findByRole("alert")).textContent).toBe(
      "FWC tiene posiciones del 1 al 19.",
    );
  });

  it("submits the lookup with Enter", async () => {
    const collection = setCopies(createEmptyCollection(), mexico1, 1);

    render(<CollectionDashboard createRepository={() => fakeRepository(collection)} />);

    await screen.findByText("1 / 980");
    const input = screen.getByLabelText("Sección y número");

    fireEvent.change(input, { target: { value: "México 1" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", charCode: 13 });

    expect(await screen.findByText("México 1")).toBeTruthy();
    expect(screen.getByText("La tenés.")).toBeTruthy();
  });

  it("shows section suggestions while typing", async () => {
    render(<CollectionDashboard createRepository={() => fakeRepository(createEmptyCollection())} />);

    await screen.findByText("0 / 980");
    fireEvent.change(screen.getByLabelText("Sección y número"), {
      target: { value: "arg" },
    });

    expect(await screen.findByRole("option", { name: "Argentina" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Argelia" })).toBeTruthy();
  });

  it("selects a suggestion with click", async () => {
    render(<CollectionDashboard createRepository={() => fakeRepository(createEmptyCollection())} />);

    await screen.findByText("0 / 980");
    fireEvent.change(screen.getByLabelText("Sección y número"), {
      target: { value: "arg" },
    });
    fireEvent.click(await screen.findByRole("option", { name: "Argentina" }));

    expect(inputValue()).toBe("Argentina ");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("selects a suggestion with keyboard navigation", async () => {
    render(<CollectionDashboard createRepository={() => fakeRepository(createEmptyCollection())} />);

    await screen.findByText("0 / 980");
    const input = screen.getByLabelText("Sección y número");

    fireEvent.change(input, { target: { value: "mex" } });
    fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(inputValue()).toBe("México ");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("keeps the typed number when selecting a suggestion", async () => {
    render(<CollectionDashboard createRepository={() => fakeRepository(createEmptyCollection())} />);

    await screen.findByText("0 / 980");
    fireEvent.change(screen.getByLabelText("Sección y número"), {
      target: { value: "core 18" },
    });
    fireEvent.click(await screen.findByRole("option", { name: "Corea del Sur" }));

    expect(inputValue()).toBe("Corea del Sur 18");
  });

  it("closes suggestions with Escape", async () => {
    render(<CollectionDashboard createRepository={() => fakeRepository(createEmptyCollection())} />);

    await screen.findByText("0 / 980");
    const input = screen.getByLabelText("Sección y número");

    fireEvent.change(input, { target: { value: "arg" } });
    expect(await screen.findByRole("listbox")).toBeTruthy();

    fireEvent.keyDown(input, { key: "Escape", code: "Escape" });

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("submits normally with Enter when there is no active suggestion", async () => {
    const collection = setCopies(createEmptyCollection(), mexico1, 1);

    render(<CollectionDashboard createRepository={() => fakeRepository(collection)} />);

    await screen.findByText("1 / 980");
    const input = screen.getByLabelText("Sección y número");

    fireEvent.change(input, { target: { value: "México 1" } });
    expect(screen.queryByRole("listbox")).toBeNull();

    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(await screen.findByText("México 1")).toBeTruthy();
    expect(screen.getByText("La tenés.")).toBeTruthy();
  });

  it("can submit a valid query after choosing a suggestion", async () => {
    const collection = setCopies(createEmptyCollection(), argentina7, 1);

    render(<CollectionDashboard createRepository={() => fakeRepository(collection)} />);

    await screen.findByText("1 / 980");
    fireEvent.change(screen.getByLabelText("Sección y número"), {
      target: { value: "arg" },
    });
    fireEvent.click(await screen.findByRole("option", { name: "Argentina" }));
    fireEvent.change(screen.getByLabelText("Sección y número"), {
      target: { value: "Argentina 7" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Consultar" }));

    expect(await screen.findByText("Argentina 7")).toBeTruthy();
    expect(screen.getByText("La tenés.")).toBeTruthy();
  });

  it("does not call the repository again when consulting", async () => {
    const load = vi.fn<() => Promise<CollectionState>>().mockResolvedValue(createEmptyCollection());
    const repository: CollectionRepository = {
      load,
      save: vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined),
      clear: vi.fn<CollectionRepository["clear"]>().mockResolvedValue(undefined),
    };

    render(<CollectionDashboard createRepository={() => repository} />);

    await screen.findByText("0 / 980");
    submitLookup("Argentina 7");

    expect(await screen.findByText("No la tenés.")).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);
    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.clear).not.toHaveBeenCalled();
  });

  it("does not call the repository while showing suggestions", async () => {
    const load = vi.fn<() => Promise<CollectionState>>().mockResolvedValue(createEmptyCollection());
    const repository: CollectionRepository = {
      load,
      save: vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined),
      clear: vi.fn<CollectionRepository["clear"]>().mockResolvedValue(undefined),
    };

    render(<CollectionDashboard createRepository={() => repository} />);

    await screen.findByText("0 / 980");
    fireEvent.change(screen.getByLabelText("Sección y número"), {
      target: { value: "arg" },
    });

    expect(await screen.findByRole("option", { name: "Argentina" })).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);
    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.clear).not.toHaveBeenCalled();
  });

  it("keeps the global summary while consulting", async () => {
    const collection = setCopies(createEmptyCollection(), panini, 3);

    render(<CollectionDashboard createRepository={() => fakeRepository(collection)} />);

    expect(await screen.findByText("1 / 980")).toBeTruthy();
    expect(metricValue("Repetidas")).toBe("2");

    submitLookup("Argentina 7");

    expect(await screen.findByText("No la tenés.")).toBeTruthy();
    expect(screen.getByText("1 / 980")).toBeTruthy();
    expect(metricValue("Repetidas")).toBe("2");
  });

  it("adds a missing queried position and updates the result and metrics", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const repository = fakeRepository(createEmptyCollection(), save);

    render(<CollectionDashboard createRepository={() => repository} />);

    await screen.findByText("0 / 980");
    submitLookup("Argentina 7");
    fireEvent.click(
      await screen.findByRole("button", { name: "Agregar figurita de Argentina 7" }),
    );

    expect(await screen.findByText("Cambio guardado.")).toBeTruthy();
    expect(screen.getByText("La tenés.")).toBeTruthy();
    expect(screen.getByText("1 copia.")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Agregar otra copia de Argentina 7" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Deshacer" })).toBeTruthy();
    expect(screen.getByText("1 / 980")).toBeTruthy();
    expect(metricValue("Pegadas")).toBe("1");
    expect(metricValue("Faltantes")).toBe("979");
    expect(screen.getByText("Tu próximo objetivo")).toBeTruthy();
    expect(screen.getByText("Faltan 9 para llegar a 10 pegadas.")).toBeTruthy();
    expect(save).toHaveBeenCalledTimes(1);
    expect(getCopies(save.mock.calls[0][0], argentina7)).toBe(1);
  });

  it("adds another copy to an owned queried position and shows repeated state", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const repository = fakeRepository(setCopies(createEmptyCollection(), argentina7, 1), save);

    render(<CollectionDashboard createRepository={() => repository} />);

    await screen.findByText("1 / 980");
    submitLookup("Argentina 7");
    fireEvent.click(
      await screen.findByRole("button", { name: "Agregar otra copia de Argentina 7" }),
    );

    expect(await screen.findByText("Cambio guardado.")).toBeTruthy();
    expect(screen.getByText("La tenés repetida.")).toBeTruthy();
    expect(screen.getByText("2 copias en total · 1 repetida.")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Entregué una copia de Argentina 7" }),
    ).toBeTruthy();
    expect(metricValue("Pegadas")).toBe("1");
    expect(metricValue("Faltantes")).toBe("979");
    expect(metricValue("Repetidas")).toBe("1");
    expect(getCopies(save.mock.calls[0][0], argentina7)).toBe(2);
  });

  it("registers that a repeated copy was given without removing the main copy", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const repository = fakeRepository(setCopies(createEmptyCollection(), panini, 2), save);

    render(<CollectionDashboard createRepository={() => repository} />);

    await screen.findByText("1 / 980");
    submitLookup("PANINI 00");
    fireEvent.click(
      await screen.findByRole("button", { name: "Entregué una copia de PANINI 00" }),
    );

    expect(await screen.findByText("Cambio guardado.")).toBeTruthy();
    expect(screen.getByText("La tenés.")).toBeTruthy();
    expect(screen.getByText("1 copia.")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Entregué una copia de PANINI 00" }),
    ).toBeNull();
    expect(metricValue("Repetidas")).toBe("0");
    expect(getCopies(save.mock.calls[0][0], panini)).toBe(1);
  });

  it("blocks lookup controls and actions while saving", async () => {
    const resolveSaveRef: { current: (() => void) | null } = { current: null };
    const save = vi.fn<CollectionRepository["save"]>(
      () =>
        new Promise<void>((resolve) => {
          resolveSaveRef.current = resolve;
        }),
    );
    const repository = fakeRepository(createEmptyCollection(), save);

    render(<CollectionDashboard createRepository={() => repository} />);

    await screen.findByText("0 / 980");
    submitLookup("Argentina 7");
    const addButton = await screen.findByRole("button", {
      name: "Agregar figurita de Argentina 7",
    });

    fireEvent.click(addButton);
    fireEvent.click(addButton);

    expect(await screen.findByText("Guardando cambio...")).toBeTruthy();
    expect((screen.getByLabelText("Sección y número") as HTMLInputElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole("button", { name: "Consultar" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((addButton as HTMLButtonElement).disabled).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);

    const finishSave = resolveSaveRef.current;
    if (!finishSave) {
      throw new Error("Save promise was not started.");
    }

    finishSave();
    expect(await screen.findByText("Cambio guardado.")).toBeTruthy();
  });

  it("rolls back on save error while keeping the queried result visible for retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const save = vi.fn<CollectionRepository["save"]>().mockRejectedValue(new Error("boom"));
    const load = vi.fn<() => Promise<CollectionState>>().mockResolvedValue(createEmptyCollection());
    const repository: CollectionRepository = {
      load,
      save,
      clear: async () => undefined,
    };

    render(<CollectionDashboard createRepository={() => repository} />);

    await screen.findByText("0 / 980");
    submitLookup("Argentina 7");
    fireEvent.click(
      await screen.findByRole("button", { name: "Agregar figurita de Argentina 7" }),
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "No fue posible guardar el cambio. Reintentá la acción.",
    );
    expect(screen.getByText("Argentina 7")).toBeTruthy();
    expect(screen.getByText("No la tenés.")).toBeTruthy();
    expect(screen.getByText("0 copias.")).toBeTruthy();
    expect(metricValue("Pegadas")).toBe("0");
    expect(metricValue("Faltantes")).toBe("980");
    expect(
      screen.getByRole("button", { name: "Agregar figurita de Argentina 7" }),
    ).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not load again after mutating from the lookup result", async () => {
    const load = vi.fn<() => Promise<CollectionState>>().mockResolvedValue(createEmptyCollection());
    const repository: CollectionRepository = {
      load,
      save: vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined),
      clear: vi.fn<CollectionRepository["clear"]>().mockResolvedValue(undefined),
    };

    render(<CollectionDashboard createRepository={() => repository} />);

    await screen.findByText("0 / 980");
    submitLookup("Argentina 7");
    fireEvent.click(
      await screen.findByRole("button", { name: "Agregar figurita de Argentina 7" }),
    );
    expect(await screen.findByText("Cambio guardado.")).toBeTruthy();

    expect(load).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it("undoes adding a missing queried position and persists the restored state", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const repository = fakeRepository(createEmptyCollection(), save);

    render(<CollectionDashboard createRepository={() => repository} />);

    await screen.findByText("0 / 980");
    submitLookup("Argentina 7");
    fireEvent.click(
      await screen.findByRole("button", { name: "Agregar figurita de Argentina 7" }),
    );
    expect(await screen.findByText("Cambio guardado.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));

    expect(await screen.findByText("Cambio deshecho.")).toBeTruthy();
    expect(screen.getByText("No la tenés.")).toBeTruthy();
    expect(screen.getByText("0 copias.")).toBeTruthy();
    expect(metricValue("Pegadas")).toBe("0");
    expect(metricValue("Faltantes")).toBe("980");
    expect(save).toHaveBeenCalledTimes(2);
    expect(getCopies(save.mock.calls[1][0], argentina7)).toBe(0);
  });

  it("undoes adding another copy to an owned queried position", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const repository = fakeRepository(setCopies(createEmptyCollection(), argentina7, 1), save);

    render(<CollectionDashboard createRepository={() => repository} />);

    await screen.findByText("1 / 980");
    submitLookup("Argentina 7");
    fireEvent.click(
      await screen.findByRole("button", { name: "Agregar otra copia de Argentina 7" }),
    );
    expect(await screen.findByText("La tenés repetida.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));

    expect(await screen.findByText("Cambio deshecho.")).toBeTruthy();
    expect(screen.getByText("La tenés.")).toBeTruthy();
    expect(screen.getByText("1 copia.")).toBeTruthy();
    expect(metricValue("Repetidas")).toBe("0");
    expect(getCopies(save.mock.calls[1][0], argentina7)).toBe(1);
  });

  it("undoes giving a repeated copy", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const repository = fakeRepository(setCopies(createEmptyCollection(), panini, 2), save);

    render(<CollectionDashboard createRepository={() => repository} />);

    await screen.findByText("1 / 980");
    submitLookup("PANINI 00");
    fireEvent.click(
      await screen.findByRole("button", { name: "Entregué una copia de PANINI 00" }),
    );
    expect(await screen.findByText("La tenés.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));

    expect(await screen.findByText("Cambio deshecho.")).toBeTruthy();
    expect(screen.getByText("La tenés repetida.")).toBeTruthy();
    expect(screen.getByText("2 copias en total · 1 repetida.")).toBeTruthy();
    expect(metricValue("Repetidas")).toBe("1");
    expect(getCopies(save.mock.calls[1][0], panini)).toBe(2);
  });

  it("keeps undo available when persisting the undo fails", async () => {
    const save = vi
      .fn<CollectionRepository["save"]>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("boom"));
    const repository = fakeRepository(createEmptyCollection(), save);

    render(<CollectionDashboard createRepository={() => repository} />);

    await screen.findByText("0 / 980");
    submitLookup("Argentina 7");
    fireEvent.click(
      await screen.findByRole("button", { name: "Agregar figurita de Argentina 7" }),
    );
    expect(await screen.findByText("Cambio guardado.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "No fue posible deshacer el cambio. Reintentá deshacer.",
    );
    expect(screen.getByText("La tenés.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Deshacer" })).toBeTruthy();
    expect(getCopies(save.mock.calls[1][0], argentina7)).toBe(0);
  });

  it("works after retrying a failed load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const load = vi
      .fn<() => Promise<CollectionState>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(setCopies(createEmptyCollection(), argentina7, 1));
    const repository: CollectionRepository = {
      load,
      save: async () => undefined,
      clear: async () => undefined,
    };

    render(<CollectionDashboard createRepository={() => repository} />);

    expect(await screen.findByText("No fue posible cargar la colección")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("1 / 980")).toBeTruthy();
    submitLookup("Argentina 7");

    expect(await screen.findByText("La tenés.")).toBeTruthy();
  });
});

describe("CollectionDashboard album insights", () => {
  it("shows the next milestone and started selections for one figurita", async () => {
    render(
      <CollectionDashboard
        createRepository={() => fakeRepository(setCopies(createEmptyCollection(), mexico1, 1))}
      />,
    );

    expect(await screen.findByText("Tu próximo objetivo")).toBeTruthy();
    expect(screen.getByText("Faltan 9 para llegar a 10 pegadas.")).toBeTruthy();
    expect(screen.getByText("1 selección iniciada de 48")).toBeTruthy();
  });

  it("moves to the next milestone after crossing an exact frontier", async () => {
    render(
      <CollectionDashboard
        createRepository={() =>
          fakeRepository(withFirstSelectionPositions(createEmptyCollection(), "México", 10))
        }
      />,
    );

    expect(await screen.findByText("Tu próximo objetivo")).toBeTruthy();
    expect(screen.getByText("Faltan 15 para llegar a 25 pegadas.")).toBeTruthy();
  });

  it("does not treat 14 of 20 as close to completion", async () => {
    render(
      <CollectionDashboard
        createRepository={() =>
          fakeRepository(withFirstSelectionPositions(createEmptyCollection(), "México", 14))
        }
      />,
    );

    expect(await screen.findByText("Tu próximo objetivo")).toBeTruthy();
    expect(screen.queryByText("México está muy cerca")).toBeNull();
  });

  it("shows one close selection with progress and album link at 15 of 20", async () => {
    render(
      <CollectionDashboard
        createRepository={() =>
          fakeRepository(withFirstSelectionPositions(createEmptyCollection(), "México", 15))
        }
      />,
    );

    expect(await screen.findByText("México está muy cerca")).toBeTruthy();
    expect(screen.getByText("15 de 20 pegadas")).toBeTruthy();
    expect(screen.getByText("Le faltan solo 5 figuritas.")).toBeTruthy();
    expect(
      screen.getByRole("progressbar", {
        name: "México: 15 de 20 figuritas pegadas",
      }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver en álbum" }).getAttribute("href")).toBe(
      "/album?section=M%C3%A9xico",
    );
  });

  it("shows one close selection with singular missing copy at 19 of 20", async () => {
    render(
      <CollectionDashboard
        createRepository={() =>
          fakeRepository(withFirstSelectionPositions(createEmptyCollection(), "México", 19))
        }
      />,
    );

    expect(await screen.findByText("México está muy cerca")).toBeTruthy();
    expect(screen.getByText("19 de 20 pegadas")).toBeTruthy();
    expect(screen.getByText("Le falta solo 1 figurita.")).toBeTruthy();
  });

  it("shows one completed selection with progress and album link", async () => {
    render(
      <CollectionDashboard
        createRepository={() =>
          fakeRepository(withFirstSelectionPositions(createEmptyCollection(), "México", 20))
        }
      />,
    );

    expect(await screen.findByText("¡México está completa!")).toBeTruthy();
    expect(screen.getByText("20 de 20 pegadas")).toBeTruthy();
    expect(screen.getByText("Ya tenés sus 20 figuritas.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver en álbum" }).getAttribute("href")).toBe(
      "/album?section=M%C3%A9xico",
    );
  });

  it("names two completed selections in canonical order", async () => {
    const collection = withFirstSelectionPositions(
      withFirstSelectionPositions(createEmptyCollection(), "Brasil", 20),
      "México",
      20,
    );

    render(<CollectionDashboard createRepository={() => fakeRepository(collection)} />);

    expect(
      await screen.findByText("¡Ya completaste México y Brasil!"),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Ver en álbum" })).toBeNull();
  });

  it("names three completed selections in canonical order", async () => {
    const collection = withFirstSelectionPositions(
      withFirstSelectionPositions(
        withFirstSelectionPositions(createEmptyCollection(), "Japón", 20),
        "Brasil",
        20,
      ),
      "México",
      20,
    );

    render(<CollectionDashboard createRepository={() => fakeRepository(collection)} />);

    expect(
      await screen.findByText("¡Ya completaste México, Brasil y Japón!"),
    ).toBeTruthy();
  });

  it("summarizes more than three completed selections without an awkward list", async () => {
    const collection = ["México", "Brasil", "Japón", "Argentina"].reduce(
      (current, section) => withFirstSelectionPositions(current, section, 20),
      createEmptyCollection(),
    );

    render(<CollectionDashboard createRepository={() => fakeRepository(collection)} />);

    expect(await screen.findByText("¡Ya completaste 4 selecciones!")).toBeTruthy();
    expect(screen.queryByText(/México, Brasil, Japón y Argentina/)).toBeNull();
  });

  it("keeps a tie between two close selections without choosing a link", async () => {
    const collection = withFirstSelectionPositions(
      withFirstSelectionPositions(createEmptyCollection(), "Brasil", 17),
      "México",
      17,
    );

    render(<CollectionDashboard createRepository={() => fakeRepository(collection)} />);

    expect(
      await screen.findByText("México y Brasil están muy cerca"),
    ).toBeTruthy();
    expect(screen.getByText("Les faltan 3 figuritas a cada una.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Ver en álbum" })).toBeNull();
  });

  it("keeps a tie between three close selections", async () => {
    const collection = ["México", "Brasil", "Japón"].reduce(
      (current, section) => withFirstSelectionPositions(current, section, 17),
      createEmptyCollection(),
    );

    render(<CollectionDashboard createRepository={() => fakeRepository(collection)} />);

    expect(
      await screen.findByText("México, Brasil y Japón están muy cerca"),
    ).toBeTruthy();
    expect(screen.getByText("Les faltan 3 figuritas a cada una.")).toBeTruthy();
  });

  it("summarizes a tie between more than three close selections", async () => {
    const collection = ["México", "Brasil", "Japón", "Argentina"].reduce(
      (current, section) => withFirstSelectionPositions(current, section, 17),
      createEmptyCollection(),
    );

    render(<CollectionDashboard createRepository={() => fakeRepository(collection)} />);

    expect(await screen.findByText("4 selecciones están muy cerca")).toBeTruthy();
    expect(screen.getByText("Les faltan 3 figuritas a cada una.")).toBeTruthy();
  });

  it("does not show duplicate secondary data when there are no repeated copies", async () => {
    render(
      <CollectionDashboard
        createRepository={() => fakeRepository(setCopies(createEmptyCollection(), mexico1, 1))}
      />,
    );

    await screen.findByText("Tu próximo objetivo");
    expect(screen.queryByText(/disponible para cambiar/)).toBeNull();
  });

  it("shows one copy available to change and links to repeated copies", async () => {
    render(
      <CollectionDashboard
        createRepository={() => fakeRepository(setCopies(createEmptyCollection(), mexico1, 2))}
      />,
    );

    expect(await screen.findByText("1 copia disponible para cambiar")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "1 copia disponible para cambiar" }).getAttribute("href"),
    ).toBe("/duplicates");
  });

  it("shows several copies available to change", async () => {
    const collection = setCopies(
      setCopies(createEmptyCollection(), mexico1, 3),
      argentina7,
      4,
    );

    render(<CollectionDashboard createRepository={() => fakeRepository(collection)} />);

    expect(
      await screen.findByText("5 copias disponibles para cambiar"),
    ).toBeTruthy();
  });

  it("shows a unique close selection as secondary when the primary insight is completed selections", async () => {
    const collection = withFirstSelectionPositions(
      withFirstSelectionPositions(createEmptyCollection(), "Argentina", 17),
      "México",
      20,
    );

    render(<CollectionDashboard createRepository={() => fakeRepository(collection)} />);

    expect(await screen.findByText("¡México está completa!")).toBeTruthy();
    expect(screen.getByText("Argentina · 17 de 20")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Argentina · 17 de 20" }).getAttribute("href"),
    ).toBe("/album?section=Argentina");
  });

  it("summarizes an almost complete album with completed selections first", async () => {
    const collection = expandCanonicalAlbumPositions().reduce((current, position) => {
      if (
        (position.section === "Panamá" && position.position === "20") ||
        (position.section === "FWC" && position.position === "19")
      ) {
        return current;
      }

      return setCopies(current, position, 1);
    }, createEmptyCollection());

    render(<CollectionDashboard createRepository={() => fakeRepository(collection)} />);

    expect(await screen.findByText("¡Ya completaste 47 selecciones!")).toBeTruthy();
    expect(screen.getByText("978 / 980")).toBeTruthy();
  });

  it("shows the complete album insight without close selection or milestone", async () => {
    const collection = expandCanonicalAlbumPositions().reduce(
      (current, position) => setCopies(current, position, 1),
      createEmptyCollection(),
    );

    render(<CollectionDashboard createRepository={() => fakeRepository(collection)} />);

    expect(await screen.findByText("¡Álbum completo!")).toBeTruthy();
    expect(screen.getByText("Completaste las 980 figuritas.")).toBeTruthy();
    expect(screen.queryByText("Tu próximo objetivo")).toBeNull();
    expect(screen.queryByText(/está muy cerca/)).toBeNull();
  });

  it("keeps long selection names visible and linkable", async () => {
    render(
      <CollectionDashboard
        createRepository={() =>
          fakeRepository(
            withFirstSelectionPositions(
              createEmptyCollection(),
              "República Democrática del Congo",
              15,
            ),
          )
        }
      />,
    );

    expect(
      await screen.findByText("República Democrática del Congo está muy cerca"),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver en álbum" }).getAttribute("href")).toBe(
      "/album?section=Rep%C3%BAblica%20Democr%C3%A1tica%20del%20Congo",
    );
  });

  it("does not call the repository again to render insights", async () => {
    const load = vi.fn<() => Promise<CollectionState>>().mockResolvedValue(
      setCopies(createEmptyCollection(), mexico1, 1),
    );
    const repository: CollectionRepository = {
      load,
      save: vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined),
      clear: vi.fn<CollectionRepository["clear"]>().mockResolvedValue(undefined),
    };

    render(<CollectionDashboard createRepository={() => repository} />);

    expect(await screen.findByText("Tu próximo objetivo")).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("updates insights after adding a figurita from the existing lookup actions", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const repository = fakeRepository(
      withFirstSelectionPositions(createEmptyCollection(), "México", 14),
      save,
    );

    render(<CollectionDashboard createRepository={() => repository} />);

    expect(await screen.findByText("Tu próximo objetivo")).toBeTruthy();
    submitLookup("México 15");
    fireEvent.click(
      await screen.findByRole("button", { name: "Agregar figurita de México 15" }),
    );

    expect(await screen.findByText("México está muy cerca")).toBeTruthy();
    expect(screen.getByText("15 de 20 pegadas")).toBeTruthy();
    expect(getCopies(save.mock.calls[0][0], mexico15)).toBe(1);
  });

  it("renders at most one primary block and two secondary rows", async () => {
    const collection = setCopies(
      withFirstSelectionPositions(createEmptyCollection(), "México", 15),
      argentina7,
      3,
    );

    render(<CollectionDashboard createRepository={() => fakeRepository(collection)} />);

    const insightsSection = (
      await screen.findByRole("heading", { name: "Así va tu álbum" })
    ).closest("section");

    if (!insightsSection) {
      throw new Error("No se encontró la sección de insights.");
    }

    expect(await within(insightsSection).findByText("México está muy cerca")).toBeTruthy();
    expect(within(insightsSection).getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("initial navigation", () => {
  it("shows the main access points", () => {
    render(<MainNavigation />);

    expect(screen.getByRole("link", { name: "Álbum" }).getAttribute("href")).toBe(
      "/album",
    );
    expect(
      screen.getByRole("link", { name: "Carga rápida" }).getAttribute("href"),
    ).toBe("/quick-entry");
    expect(
      screen.getByRole("link", { name: "Faltantes" }).getAttribute("href"),
    ).toBe("/missing");
    expect(
      screen.getByRole("link", { name: "Repetidas" }).getAttribute("href"),
    ).toBe("/duplicates");
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

function metricValue(label: string): string {
  const labelNode = screen.getByText(label);
  const value = labelNode.parentElement?.querySelector("dd")?.textContent;

  if (value === undefined || value === null) {
    throw new Error(`No se encontró la métrica ${label}.`);
  }

  return value;
}

function submitLookup(value: string): void {
  fireEvent.change(screen.getByLabelText("Sección y número"), {
    target: { value },
  });
  fireEvent.click(screen.getByRole("button", { name: "Consultar" }));
}

function inputValue(): string {
  return (screen.getByLabelText("Sección y número") as HTMLInputElement).value;
}

function withFirstSelectionPositions(
  collection: CollectionState,
  section: string,
  count: number,
): CollectionState {
  return Array.from({ length: count }, (_, index) => ({
    section,
    position: String(index + 1),
  })).reduce(
    (current, position) => setCopies(current, position, 1),
    collection,
  );
}
