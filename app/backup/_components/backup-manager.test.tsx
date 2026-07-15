/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createEmptyCollection,
  getCopies,
  makePositionKey,
  setCopies,
  type CollectionState,
} from "../../../domain/collection/collection";
import type { CollectionRepository } from "../../../infrastructure/persistence/collection-repository";
import { MainNavigation } from "../../_components/main-navigation";
import { BackupManager } from "./backup-manager";

const exportedAt = new Date("2026-07-15T12:00:00.000Z");
const panini = { section: "PANINI", position: "00" };
const argentina7 = { section: "Argentina", position: "7" };
const mexico1 = { section: "México", position: "1" };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("BackupManager", () => {
  it("shows loading before resolving the collection", () => {
    render(
      <BackupManager
        createRepository={() => ({
          load: () => new Promise<CollectionState>(() => undefined),
          save: async () => undefined,
          clear: async () => undefined,
        })}
      />,
    );

    expect(screen.getByText("Cargando colección")).toBeTruthy();
    expect(screen.getByText("Preparando respaldo...")).toBeTruthy();
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

    render(<BackupManager createRepository={() => repository} />);

    expect(await screen.findByText("No fue posible cargar la colección")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("heading", { name: "Exportar respaldo" })).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("exports an empty collection backup", async () => {
    const download = vi.fn();

    render(
      <BackupManager
        createRepository={() => fakeRepository(createEmptyCollection())}
        downloadTextFile={download}
        now={() => exportedAt}
      />,
    );

    await screen.findByRole("heading", { name: "Exportar respaldo" });
    fireEvent.click(screen.getByRole("button", { name: "Exportar respaldo" }));

    expect(download).toHaveBeenCalledWith(
      "figus-pani-backup-2026-07-15.json",
      expect.stringContaining('"type": "figus-pani-backup"'),
    );
    expect(download.mock.calls[0][1]).toContain('"copiesByPosition": {}');
    expect(screen.getByText("Respaldo generado: figus-pani-backup-2026-07-15.json")).toBeTruthy();
  });

  it("exports a partial collection with copies", async () => {
    const download = vi.fn();
    const collection = setCopies(createEmptyCollection(), argentina7, 2);

    render(
      <BackupManager
        createRepository={() => fakeRepository(collection)}
        downloadTextFile={download}
        now={() => exportedAt}
      />,
    );

    await screen.findByRole("heading", { name: "Exportar respaldo" });
    fireEvent.click(screen.getByRole("button", { name: "Exportar respaldo" }));

    expect(download.mock.calls[0][1]).toContain('"Argentina|7": 2');
  });

  it("reads an invalid JSON file", async () => {
    render(
      <BackupManager
        createRepository={() => fakeRepository(createEmptyCollection())}
        readFileText={async () => "{bad"}
      />,
    );

    await screen.findByRole("heading", { name: "Restaurar respaldo" });
    await chooseFile(file("backup.json", "{}"));

    expect(await screen.findByText("No se puede restaurar este archivo.")).toBeTruthy();
    expect(screen.getByText("El archivo no es JSON válido.")).toBeTruthy();
  });

  it("reports unsupported backup versions", async () => {
    render(
      <BackupManager
        createRepository={() => fakeRepository(createEmptyCollection())}
        readFileText={async () =>
          JSON.stringify({
            type: "figus-pani-backup",
            formatVersion: 2,
            exportedAt: "2026-07-15T12:00:00.000Z",
            copiesByPosition: {},
          })
        }
      />,
    );

    await screen.findByRole("heading", { name: "Restaurar respaldo" });
    await chooseFile(file("backup.json", "{}"));

    expect(await screen.findByText("La versión del respaldo no está soportada.")).toBeTruthy();
  });

  it("shows a valid preview and comparison before restoring", async () => {
    const current = setCopies(createEmptyCollection(), panini, 1);
    const backupText = validBackupText({
      [makePositionKey(argentina7)]: 4,
      [makePositionKey(mexico1)]: 1,
    });

    render(
      <BackupManager
        createRepository={() => fakeRepository(current)}
        readFileText={async () => backupText}
      />,
    );

    await screen.findByRole("heading", { name: "Restaurar respaldo" });
    await chooseFile(file("backup.json", backupText));

    expect(await screen.findByText("Archivo válido")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Respaldo del/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Colección actual" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Respaldo" })).toBeTruthy();
    expect(screen.getByText("La colección actual será reemplazada por completo.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reemplazar colección actual" })).toBeTruthy();
  });

  it("requires explicit confirmation and restores successfully", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const backupText = validBackupText({
      [makePositionKey(argentina7)]: 4,
    });

    render(
      <BackupManager
        createRepository={() => fakeRepository(createEmptyCollection(), save)}
        readFileText={async () => backupText}
      />,
    );

    await screen.findByRole("heading", { name: "Restaurar respaldo" });
    await chooseFile(file("backup.json", backupText));

    expect(save).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Reemplazar colección actual" }));

    expect(await screen.findByText("Colección restaurada correctamente.")).toBeTruthy();
    expect(save).toHaveBeenCalledTimes(1);
    expect(getCopies(save.mock.calls[0][0], argentina7)).toBe(4);
    expect(screen.queryByRole("button", { name: "Reemplazar colección actual" })).toBeNull();
  });

  it("updates local summary after restoring", async () => {
    const save = vi.fn<CollectionRepository["save"]>().mockResolvedValue(undefined);
    const backupText = validBackupText({
      [makePositionKey(argentina7)]: 4,
    });

    render(
      <BackupManager
        createRepository={() => fakeRepository(createEmptyCollection(), save)}
        readFileText={async () => backupText}
      />,
    );

    await screen.findByRole("heading", { name: "Restaurar respaldo" });
    await chooseFile(file("backup.json", backupText));
    fireEvent.click(await screen.findByRole("button", { name: "Reemplazar colección actual" }));

    expect(await screen.findByText("Colección restaurada correctamente.")).toBeTruthy();
    expect(screen.getAllByText("1")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ir al inicio" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Ver álbum" }).getAttribute("href")).toBe("/album");
  });

  it("keeps preview and allows retry when saving fails", async () => {
    const save = vi
      .fn<CollectionRepository["save"]>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);
    const backupText = validBackupText({
      [makePositionKey(argentina7)]: 2,
    });

    render(
      <BackupManager
        createRepository={() => fakeRepository(createEmptyCollection(), save)}
        readFileText={async () => backupText}
      />,
    );

    await screen.findByRole("heading", { name: "Restaurar respaldo" });
    await chooseFile(file("backup.json", backupText));
    fireEvent.click(await screen.findByRole("button", { name: "Reemplazar colección actual" }));

    expect(await screen.findByText("No fue posible restaurar. La colección actual no se modificó.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reemplazar colección actual" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Reemplazar colección actual" }));
    expect(await screen.findByText("Colección restaurada correctamente.")).toBeTruthy();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("blocks double confirmation while restoring", async () => {
    let resolveSave: (() => void) | null = null;
    const save = vi.fn<CollectionRepository["save"]>(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const backupText = validBackupText({
      [makePositionKey(argentina7)]: 2,
    });

    render(
      <BackupManager
        createRepository={() => fakeRepository(createEmptyCollection(), save)}
        readFileText={async () => backupText}
      />,
    );

    await screen.findByRole("heading", { name: "Restaurar respaldo" });
    await chooseFile(file("backup.json", backupText));
    const button = await screen.findByRole("button", {
      name: "Reemplazar colección actual",
    });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(await screen.findByRole("button", { name: "Restaurando..." })).toBeTruthy();
    expect(save).toHaveBeenCalledTimes(1);

    resolveSave?.();
    expect(await screen.findByText("Colección restaurada correctamente.")).toBeTruthy();
  });

  it("rejects files that are too large", async () => {
    render(
      <BackupManager
        createRepository={() => fakeRepository(createEmptyCollection())}
        maxFileBytes={5}
      />,
    );

    await screen.findByRole("heading", { name: "Restaurar respaldo" });
    await chooseFile(file("backup.json", "123456"));

    expect(await screen.findByText("El archivo es demasiado grande.")).toBeTruthy();
  });

  it("rejects unexpected extensions", async () => {
    render(<BackupManager createRepository={() => fakeRepository(createEmptyCollection())} />);

    await screen.findByRole("heading", { name: "Restaurar respaldo" });
    await chooseFile(file("backup.txt", "{}"));

    expect(await screen.findByText("Seleccioná un archivo .json.")).toBeTruthy();
  });
});

describe("MainNavigation backup access", () => {
  it("links to backup", () => {
    render(<MainNavigation />);

    expect(screen.getByRole("link", { name: "Respaldo" }).getAttribute("href")).toBe(
      "/backup",
    );
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

function validBackupText(copiesByPosition: Record<string, number>): string {
  return JSON.stringify({
    type: "figus-pani-backup",
    formatVersion: 1,
    exportedAt: "2026-07-15T12:00:00.000Z",
    copiesByPosition,
  });
}

function file(name: string, contents: string, type = "application/json"): File {
  return new File([contents], name, { type });
}

async function chooseFile(selectedFile: File): Promise<void> {
  fireEvent.change(screen.getByLabelText("Archivo JSON"), {
    target: { files: [selectedFile] },
  });
  await waitFor(() => {
    expect(screen.queryByText("Validando archivo...")).toBeNull();
  });
}
