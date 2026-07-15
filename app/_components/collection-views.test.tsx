/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expandCanonicalAlbumPositions } from "../../domain/album/canonical-album";
import {
  createEmptyCollection,
  getCopies,
  setCopies,
  type CollectionState,
} from "../../domain/collection/collection";
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
    expect(getCopies(save.mock.calls[0][0], argentina7)).toBe(1);
  });

  it("blocks duplicate delivery while a save is pending", async () => {
    let resolveSave: (() => void) | null = null;
    const save = vi.fn<CollectionRepository["save"]>(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
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

    resolveSave?.();
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
