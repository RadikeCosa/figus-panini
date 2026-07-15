/**
 * @vitest-environment jsdom
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createEmptyCollection,
  getCopies,
  setCopies,
  type CollectionState,
} from "../../../domain/collection/collection";
import type { CollectionRepository } from "../../../infrastructure/persistence/collection-repository";
import { QuickEntryFlow } from "./quick-entry-flow";

const panini = { section: "PANINI", position: "00" };
const fwc4 = { section: "FWC", position: "4" };
const mexico1 = { section: "México", position: "1" };
const argentina7 = { section: "Argentina", position: "7" };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("QuickEntryFlow", () => {
  it("shows loading before resolving the collection", () => {
    render(
      <QuickEntryFlow
        createRepository={() => ({
          load: () => new Promise<CollectionState>(() => undefined),
          save: async () => undefined,
          clear: async () => undefined,
        })}
      />,
    );

    expect(screen.getByText("Cargando colección")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Buscar posición" })).toBeNull();
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

    render(<QuickEntryFlow createRepository={() => repository} />);

    expect(await screen.findByText("No fue posible cargar la colección")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("heading", { name: "Buscar posición" })).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shows a valid query with current quantity", async () => {
    render(<QuickEntryFlow createRepository={() => fakeRepository(createEmptyCollection())} />);

    await screen.findByRole("heading", { name: "Buscar posición" });
    submitQuery("Argentina 7");

    expect(await screen.findByRole("heading", { name: "Argentina 7" })).toBeTruthy();
    expect(screen.getByText(/Faltante · 0 copias/)).toBeTruthy();
  });

  it("shows invalid query errors", async () => {
    render(<QuickEntryFlow createRepository={() => fakeRepository(createEmptyCollection())} />);

    await screen.findByRole("heading", { name: "Buscar posición" });
    submitQuery("Italia 7");

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Esa sección no existe en este álbum.",
    );
  });

  it("shows and selects suggestions", async () => {
    render(<QuickEntryFlow createRepository={() => fakeRepository(createEmptyCollection())} />);

    await screen.findByRole("heading", { name: "Buscar posición" });
    fireEvent.change(screen.getByLabelText("Sección y número"), {
      target: { value: "mex" },
    });
    fireEvent.click(await screen.findByRole("option", { name: "México" }));

    expect(inputValue()).toBe("México ");
  });

  it("selects suggestions with keyboard", async () => {
    render(<QuickEntryFlow createRepository={() => fakeRepository(createEmptyCollection())} />);

    await screen.findByRole("heading", { name: "Buscar posición" });
    const input = screen.getByLabelText("Sección y número");

    fireEvent.change(input, { target: { value: "pan" } });
    fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(inputValue()).toBe("PANINI ");
  });

  it("keeps suggestions scrollable without reducing the available options", async () => {
    render(<QuickEntryFlow createRepository={() => fakeRepository(createEmptyCollection())} />);

    await screen.findByRole("heading", { name: "Buscar posición" });
    fireEvent.change(screen.getByLabelText("Sección y número"), {
      target: { value: "a" },
    });

    const listbox = await screen.findByRole("listbox");

    expect(listbox.className).toContain("max-h-40");
    expect(listbox.className).toContain("overflow-y-auto");
    expect(screen.getAllByRole("option").length).toBeGreaterThanOrEqual(3);
  });

  it("adds the first copy and persists the expected collection", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const repository = fakeRepository(createEmptyCollection(), save);

    render(<QuickEntryFlow createRepository={() => repository} />);

    await screen.findByRole("heading", { name: "Buscar posición" });
    submitQuery("México 1");
    fireEvent.click(await screen.findByRole("button", { name: "Agregar copia" }));

    expect(await screen.findByText(/México 1 agregada/)).toBeTruthy();
    expect(screen.getByText(/Ahora tenés 1 copia\./)).toBeTruthy();
    expect(inputValue()).toBe("");
    expect(document.activeElement).toBe(screen.getByLabelText("Sección y número"));
    expect(save).toHaveBeenCalledTimes(1);
    expect(getCopies(save.mock.calls[0][0], mexico1)).toBe(1);
  });

  it("adds a repeated copy", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const repository = fakeRepository(setCopies(createEmptyCollection(), mexico1, 2), save);

    render(<QuickEntryFlow createRepository={() => repository} />);

    await screen.findByRole("heading", { name: "Buscar posición" });
    submitQuery("México 1");
    fireEvent.click(await screen.findByRole("button", { name: "Agregar copia" }));

    expect(await screen.findByText(/Ahora tenés 3 copias · 2 repetidas\./)).toBeTruthy();
    expect(getCopies(save.mock.calls[0][0], mexico1)).toBe(3);
  });

  it("blocks double submit while saving", async () => {
    let resolveSave: (() => void) | null = null;
    const save = vi.fn<CollectionRepository["save"]>(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const repository = fakeRepository(createEmptyCollection(), save);

    render(<QuickEntryFlow createRepository={() => repository} />);

    await screen.findByRole("heading", { name: "Buscar posición" });
    submitQuery("México 1");
    const addButton = await screen.findByRole("button", { name: "Agregar copia" });
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    expect(await screen.findByText("Guardando...")).toBeTruthy();
    expect((addButton as HTMLButtonElement).disabled).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);

    resolveSave?.();
    expect(await screen.findByText("Guardado.")).toBeTruthy();
  });

  it("rolls back when saving fails and allows retry", async () => {
    const save = vi
      .fn<CollectionRepository["save"]>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);
    const repository = fakeRepository(createEmptyCollection(), save);

    render(<QuickEntryFlow createRepository={() => repository} />);

    await screen.findByRole("heading", { name: "Buscar posición" });
    submitQuery("México 1");
    fireEvent.click(await screen.findByRole("button", { name: "Agregar copia" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "No fue posible guardar. Se restauró el estado anterior.",
    );
    submitQuery("México 1");
    fireEvent.click(await screen.findByRole("button", { name: "Agregar copia" }));

    expect(await screen.findByText(/Ahora tenés 1 copia\./)).toBeTruthy();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("undoes the last successful addition", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const repository = fakeRepository(createEmptyCollection(), save);

    render(<QuickEntryFlow createRepository={() => repository} />);

    await screen.findByRole("heading", { name: "Buscar posición" });
    submitQuery("México 1");
    fireEvent.click(await screen.findByRole("button", { name: "Agregar copia" }));
    expect(await screen.findByText(/Ahora tenés 1 copia\./)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));

    expect(await screen.findByText(/Se deshizo México 1/)).toBeTruthy();
    expect(screen.getByText(/Ahora no la tenés\./)).toBeTruthy();
    expect(getCopies(save.mock.calls[1][0], mexico1)).toBe(0);
  });

  it("keeps state when undo saving fails", async () => {
    const save = vi
      .fn<CollectionRepository["save"]>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("boom"));
    const repository = fakeRepository(createEmptyCollection(), save);

    render(<QuickEntryFlow createRepository={() => repository} />);

    await screen.findByRole("heading", { name: "Buscar posición" });
    submitQuery("México 1");
    fireEvent.click(await screen.findByRole("button", { name: "Agregar copia" }));
    expect(await screen.findByText(/Ahora tenés 1 copia\./)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "No fue posible guardar. Se restauró el estado anterior.",
    );
    submitQuery("México 1");
    expect(await screen.findByText(/Pegada · 1 copia/)).toBeTruthy();
  });

  it("does not load again for each addition", async () => {
    const load = vi.fn<() => Promise<CollectionState>>().mockResolvedValue(createEmptyCollection());
    const repository: CollectionRepository = {
      load,
      save: vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined),
      clear: vi.fn<CollectionRepository["clear"]>().mockResolvedValue(undefined),
    };

    render(<QuickEntryFlow createRepository={() => repository} />);

    await screen.findByRole("heading", { name: "Buscar posición" });
    submitQuery("México 1");
    fireEvent.click(await screen.findByRole("button", { name: "Agregar copia" }));
    expect(await screen.findByText(/Ahora tenés 1 copia\./)).toBeTruthy();

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("supports PANINI, FWC and selections", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const repository = fakeRepository(createEmptyCollection(), save);

    render(<QuickEntryFlow createRepository={() => repository} />);

    await screen.findByRole("heading", { name: "Buscar posición" });
    submitQuery("PANINI 00");
    fireEvent.click(await screen.findByRole("button", { name: "Agregar copia" }));
    expect(await screen.findByText(/PANINI 00 agregada/)).toBeTruthy();

    submitQuery("FWC 4");
    fireEvent.click(await screen.findByRole("button", { name: "Agregar copia" }));
    expect(await screen.findByText(/FWC 4 agregada/)).toBeTruthy();

    submitQuery("Argentina 7");
    fireEvent.click(await screen.findByRole("button", { name: "Agregar copia" }));
    expect(await screen.findByText(/Argentina 7 agregada/)).toBeTruthy();

    expect(getCopies(save.mock.calls[2][0], panini)).toBe(1);
    expect(getCopies(save.mock.calls[2][0], fwc4)).toBe(1);
    expect(getCopies(save.mock.calls[2][0], argentina7)).toBe(1);
  });

  it("keeps persisted state visible after reloading from repository", async () => {
    const repository = statefulRepository(createEmptyCollection());

    const { unmount } = render(<QuickEntryFlow createRepository={() => repository} />);

    await screen.findByRole("heading", { name: "Buscar posición" });
    submitQuery("México 12");
    fireEvent.click(await screen.findByRole("button", { name: "Agregar copia" }));
    expect(await screen.findByText(/Ahora tenés 1 copia\./)).toBeTruthy();

    unmount();
    render(<QuickEntryFlow createRepository={() => repository} />);

    await screen.findByRole("heading", { name: "Buscar posición" });
    submitQuery("México 12");
    expect(await screen.findByText(/Pegada · 1 copia/)).toBeTruthy();
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

function statefulRepository(initial: CollectionState): CollectionRepository {
  let collection = initial;

  return {
    load: async () => collection,
    save: async (nextCollection) => {
      collection = nextCollection;
    },
    clear: async () => {
      collection = createEmptyCollection();
    },
  };
}

function submitQuery(value: string): void {
  fireEvent.change(screen.getByLabelText("Sección y número"), {
    target: { value },
  });
  fireEvent.click(screen.getByRole("button", { name: "Consultar" }));
}

function inputValue(): string {
  return (screen.getByLabelText("Sección y número") as HTMLInputElement).value;
}
