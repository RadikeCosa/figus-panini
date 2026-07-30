/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "navigator",
);
const originalExecCommand = document.execCommand;

afterEach(() => {
  vi.restoreAllMocks();

  if (originalNavigatorDescriptor) {
    Object.defineProperty(globalThis, "navigator", originalNavigatorDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "navigator");
  }

  document.execCommand = originalExecCommand;
  document.body.innerHTML = "";
});

describe("copy text", () => {
  it("does not access navigator when the module is imported", async () => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      get() {
        throw new Error("navigator should not be read during import");
      },
    });

    await expect(import("./copy-text")).resolves.toBeTruthy();
  });

  it("copies text with the Clipboard API when available", async () => {
    const { copyText } = await import("./copy-text");
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(
      undefined,
    );

    mockNavigator({ clipboard: { writeText } });

    await expect(copyText("México: 1, 4")).resolves.toEqual({ status: "copied" });
    expect(writeText).toHaveBeenCalledWith("México: 1, 4");
  });

  it("falls back when the Clipboard API rejects the copy request", async () => {
    const { copyText } = await import("./copy-text");
    const execCommand = vi.fn<(command: string) => boolean>().mockReturnValue(true);

    document.execCommand = execCommand;
    mockNavigator({
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("blocked")),
      },
    });

    await expect(copyText("lista")).resolves.toEqual({ status: "copied" });
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("returns manual text when Clipboard API and textarea fallback both fail", async () => {
    const { copyText } = await import("./copy-text");

    document.execCommand = vi.fn().mockReturnValue(false);
    mockNavigator({
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("blocked")),
      },
    });

    await expect(copyText("lista")).resolves.toEqual({
      status: "manual",
      text: "lista",
    });
  });

  it("uses a textarea fallback and restores focus when Clipboard API is unavailable", async () => {
    const { copyText } = await import("./copy-text");
    const button = document.createElement("button");
    const execCommand = vi.fn<(command: string) => boolean>().mockReturnValue(true);

    document.body.append(button);
    button.focus();
    document.execCommand = execCommand;
    mockNavigator({});

    await expect(copyText("FWC: 1, 2")).resolves.toEqual({ status: "copied" });
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("returns manual text when the textarea fallback cannot copy", async () => {
    const { copyText } = await import("./copy-text");

    document.execCommand = vi.fn().mockReturnValue(false);
    mockNavigator({});

    await expect(copyText("Argentina: 7")).resolves.toEqual({
      status: "manual",
      text: "Argentina: 7",
    });
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("cleans up and returns manual text when execCommand throws", async () => {
    const { copyText } = await import("./copy-text");

    document.execCommand = vi.fn(() => {
      throw new Error("copy failed");
    });
    mockNavigator({});

    await expect(copyText("Argentina: 7")).resolves.toEqual({
      status: "manual",
      text: "Argentina: 7",
    });
    expect(document.querySelector("textarea")).toBeNull();
  });
});

function mockNavigator(navigatorMock: Record<string, unknown>): void {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: navigatorMock,
  });
}
