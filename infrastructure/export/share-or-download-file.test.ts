/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { shareOrDownloadFile } from "./share-or-download-file";

const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "navigator",
);

afterEach(() => {
  vi.restoreAllMocks();
  if (originalNavigatorDescriptor) {
    Object.defineProperty(globalThis, "navigator", originalNavigatorDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "navigator");
  }
});

describe("share or download file", () => {
  it("shares files when the browser supports file sharing", async () => {
    const file = new File(["pdf"], "figuritas-faltantes-2026-07-30.pdf", {
      type: "application/pdf",
    });
    const share = vi.fn().mockResolvedValue(undefined);

    mockNavigator({ canShare: () => true, share });

    await expect(
      shareOrDownloadFile(file, {
        title: "Figuritas faltantes",
        text: "Estas son las figuritas que nos faltan para completar el álbum.",
      }),
    ).resolves.toEqual({ status: "shared" });
    expect(share).toHaveBeenCalledWith({
      files: [file],
      title: "Figuritas faltantes",
      text: "Estas son las figuritas que nos faltan para completar el álbum.",
    });
  });

  it("treats AbortError as cancellation", async () => {
    const file = new File(["pdf"], "figuritas-faltantes-2026-07-30.pdf", {
      type: "application/pdf",
    });

    mockNavigator({
      canShare: () => true,
      share: vi.fn().mockRejectedValue(new DOMException("canceled", "AbortError")),
    });

    await expect(
      shareOrDownloadFile(file, { title: "Figuritas faltantes", text: "Lista" }),
    ).resolves.toEqual({ status: "canceled" });
  });

  it("downloads and revokes the object URL when file sharing is not supported", async () => {
    const file = new File(["pdf"], "figuritas-faltantes-2026-07-30.pdf", {
      type: "application/pdf",
    });
    const append = vi.spyOn(document.body, "append");
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:missing-list");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(
      () => undefined,
    );

    mockNavigator({ canShare: () => false, share: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await expect(
      shareOrDownloadFile(file, { title: "Figuritas faltantes", text: "Lista" }),
    ).resolves.toEqual({ status: "downloaded" });

    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(append).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:missing-list");
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("downloads when the Web Share API is not available", async () => {
    const file = new File(["pdf"], "figuritas-faltantes-2026-07-30.pdf", {
      type: "application/pdf",
    });

    mockNavigator({});
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:missing-list");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await expect(
      shareOrDownloadFile(file, { title: "Figuritas faltantes", text: "Lista" }),
    ).resolves.toEqual({ status: "downloaded" });
  });

  it("revokes the object URL when the synthetic click fails", async () => {
    const file = new File(["pdf"], "figuritas-faltantes-2026-07-30.pdf", {
      type: "application/pdf",
    });
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(
      () => undefined,
    );

    mockNavigator({ canShare: () => false, share: vi.fn() });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:missing-list");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("blocked");
    });

    await expect(
      shareOrDownloadFile(file, { title: "Figuritas faltantes", text: "Lista" }),
    ).rejects.toThrow("blocked");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:missing-list");
    expect(document.querySelector("a[download]")).toBeNull();
  });
});

function mockNavigator(navigatorMock: {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
}): void {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: navigatorMock,
  });
}
