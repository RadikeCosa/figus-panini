/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expandCanonicalAlbumPositions } from "../../domain/album/canonical-album";
import {
  createEmptyCollection,
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
});

function fakeRepository(collection: CollectionState): CollectionRepository {
  return {
    load: async () => collection,
    save: async () => undefined,
    clear: async () => undefined,
  };
}

function selectSection(section: string): void {
  fireEvent.change(screen.getByLabelText(/Filtrar/), {
    target: { value: section },
  });
}
