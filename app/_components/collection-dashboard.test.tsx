/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createEmptyCollection,
  setCopies,
  type CollectionState,
} from "../../domain/collection/collection";
import type { CollectionRepository } from "../../infrastructure/persistence/collection-repository";
import { CollectionDashboard } from "./collection-dashboard";
import { MainNavigation } from "./main-navigation";
import { PlaceholderPage } from "./placeholder-page";

const mexico1 = { section: "México", position: "1" };
const mexico2 = { section: "México", position: "2" };
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
  });

  it("shows an empty loaded collection as 0 / 980", async () => {
    render(<CollectionDashboard createRepository={() => fakeRepository(createEmptyCollection())} />);

    expect(await screen.findByText("0 / 980")).toBeTruthy();
    expect(screen.getByText("0% completado")).toBeTruthy();
    expect(metricValue("Pegadas")).toBe("0");
    expect(metricValue("Faltantes")).toBe("980");
    expect(metricValue("Repetidas")).toBe("0");
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

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("1 / 980")).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("initial navigation and placeholders", () => {
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

  it("renders honest placeholders for future routes", () => {
    render(<PlaceholderPage title="Álbum" />);

    expect(screen.getByRole("heading", { level: 1, name: "Álbum" })).toBeTruthy();
    expect(
      screen.getByText("Esta funcionalidad todavía no está implementada."),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Volver al inicio" })).toBeTruthy();
  });
});

function fakeRepository(collection: CollectionState): CollectionRepository {
  return {
    load: async () => collection,
    save: async () => undefined,
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
