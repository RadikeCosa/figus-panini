/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PwaRuntime,
  isAndroidChromiumLike,
  isIosOrIpadOs,
  isRunningStandalone,
  shouldRegisterServiceWorker,
  type PwaInstallEnvironment,
  type ServiceWorkerRegistrationEnvironment,
} from "./pwa-runtime";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setNavigatorOnline(true);
  deleteServiceWorkerMock();
  setInstallEnvironment();
});

describe("shouldRegisterServiceWorker", () => {
  it("registers only in production browser environments with service worker support", () => {
    const environment: ServiceWorkerRegistrationEnvironment = {
      nodeEnv: "production",
      hasNavigator: true,
      hasServiceWorker: true,
      protocol: "https:",
    };

    expect(shouldRegisterServiceWorker(environment)).toBe(true);
  });

  it("does not register during development, tests or server rendering", () => {
    expect(
      shouldRegisterServiceWorker({
        nodeEnv: "development",
        hasNavigator: true,
        hasServiceWorker: true,
        protocol: "http:",
      }),
    ).toBe(false);
    expect(
      shouldRegisterServiceWorker({
        nodeEnv: "test",
        hasNavigator: true,
        hasServiceWorker: true,
        protocol: "http:",
      }),
    ).toBe(false);
    expect(
      shouldRegisterServiceWorker({
        nodeEnv: "production",
        hasNavigator: false,
        hasServiceWorker: false,
        protocol: undefined,
      }),
    ).toBe(false);
  });
});

describe("PWA install environment helpers", () => {
  it("detects iPhone, iPad and iPadOS desktop user agents", () => {
    expect(
      isIosOrIpadOs({
        ...baseInstallEnvironment,
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
        platform: "iPhone",
      }),
    ).toBe(true);
    expect(
      isIosOrIpadOs({
        ...baseInstallEnvironment,
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it("detects Android Chromium-like browsers without treating iOS as Android", () => {
    expect(
      isAndroidChromiumLike({
        ...baseInstallEnvironment,
        userAgent:
          "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36",
      }),
    ).toBe(true);
    expect(
      isAndroidChromiumLike({
        ...baseInstallEnvironment,
        userAgent:
          "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 SamsungBrowser/27.0 Chrome/126 Mobile Safari/537.36",
      }),
    ).toBe(true);
    expect(
      isAndroidChromiumLike({
        ...baseInstallEnvironment,
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      }),
    ).toBe(false);
  });

  it("detects standalone mode through display-mode or iOS navigator state", () => {
    expect(
      isRunningStandalone({
        ...baseInstallEnvironment,
        standaloneDisplayMode: true,
      }),
    ).toBe(true);
    expect(
      isRunningStandalone({
        ...baseInstallEnvironment,
        standaloneNavigator: true,
      }),
    ).toBe(true);
  });
});

describe("PwaRuntime", () => {
  it("does not register the service worker when registration is disabled", async () => {
    const serviceWorker = installServiceWorkerMock();

    render(<PwaRuntime registrationEnabled={false} />);

    await waitFor(() => expect(serviceWorker.register).not.toHaveBeenCalled());
  });

  it("registers the service worker safely when enabled", async () => {
    const serviceWorker = installServiceWorkerMock();

    render(<PwaRuntime registrationEnabled />);

    await waitFor(() => {
      expect(serviceWorker.register).toHaveBeenCalledWith("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
    });
  });

  it("shows a discrete offline indicator", () => {
    setNavigatorOnline(false);

    render(<PwaRuntime registrationEnabled={false} />);

    expect(screen.getByRole("status")).toBeTruthy();
    expect(
      screen.getByText("Sin conexión · tus datos siguen disponibles en este dispositivo"),
    ).toBeTruthy();
  });

  it("shows an update action when a new worker is installed", async () => {
    const serviceWorker = installServiceWorkerMock({ hasController: true });

    render(<PwaRuntime registrationEnabled />);

    await waitFor(() => expect(serviceWorker.register).toHaveBeenCalled());
    serviceWorker.dispatchUpdateFound();
    serviceWorker.installing.state = "installed";
    serviceWorker.dispatchInstallingStateChange();

    expect(await screen.findByRole("button", { name: "Actualizar" })).toBeTruthy();
  });

  it("captures beforeinstallprompt and runs the prompt only after an explicit click", async () => {
    setInstallEnvironment({
      userAgent:
        "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36",
    });
    const installEvent = createBeforeInstallPromptEvent("accepted");

    render(<PwaRuntime registrationEnabled={false} />);
    window.dispatchEvent(installEvent);

    expect(installEvent.defaultPrevented).toBe(true);
    expect(await screen.findByText("Usar como app")).toBeTruthy();
    expect(installEvent.prompt).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Instalar app" }));

    await waitFor(() => expect(installEvent.prompt).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Instalar app" })).toBeNull();
    });
  });

  it("keeps the install action available when the user cancels the prompt", async () => {
    setInstallEnvironment({
      userAgent:
        "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36",
    });
    const installEvent = createBeforeInstallPromptEvent("dismissed");

    render(<PwaRuntime registrationEnabled={false} />);
    window.dispatchEvent(installEvent);
    fireEvent.click(await screen.findByRole("button", { name: "Instalar app" }));

    await waitFor(() => expect(installEvent.prompt).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Instalar app" })).toBeTruthy();
  });

  it("hides the install invitation after appinstalled", async () => {
    setInstallEnvironment({
      userAgent:
        "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36",
    });
    const installEvent = createBeforeInstallPromptEvent("dismissed");

    render(<PwaRuntime registrationEnabled={false} />);
    window.dispatchEvent(installEvent);

    expect(await screen.findByRole("button", { name: "Instalar app" })).toBeTruthy();

    window.dispatchEvent(new Event("appinstalled"));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Instalar app" })).toBeNull();
    });
  });

  it("does not show install help while running standalone", async () => {
    setInstallEnvironment({
      userAgent:
        "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36",
      standaloneDisplayMode: true,
    });
    const installEvent = createBeforeInstallPromptEvent("dismissed");

    render(<PwaRuntime registrationEnabled={false} />);
    window.dispatchEvent(installEvent);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Instalar app" })).toBeNull();
    });
  });

  it("shows iOS add-to-home-screen guidance without a fake install button", async () => {
    setInstallEnvironment({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      platform: "iPhone",
    });

    render(<PwaRuntime registrationEnabled={false} />);

    expect(await screen.findByText("Cómo agregarla")).toBeTruthy();
    expect(screen.getByText("Tocá Compartir.")).toBeTruthy();
    expect(screen.getByText("Elegí Agregar a pantalla de inicio.")).toBeTruthy();
    expect(screen.getByText("Tocá Agregar.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Instalar app" })).toBeNull();
  });

  it("shows Android menu guidance without a fake install button when no prompt event exists", async () => {
    setInstallEnvironment({
      userAgent:
        "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36",
    });

    render(<PwaRuntime registrationEnabled={false} />);

    expect(
      await screen.findByText("También podés instalarla desde el menú del navegador."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Instalar app" })).toBeNull();
    expect(screen.queryByText("Tocá Compartir.")).toBeNull();
  });
});

const baseInstallEnvironment: PwaInstallEnvironment = {
  userAgent: "",
  platform: "",
  maxTouchPoints: 0,
  standaloneNavigator: false,
  standaloneDisplayMode: false,
};

function installServiceWorkerMock({ hasController = false } = {}) {
  let updateFoundListener: (() => void) | null = null;
  let stateChangeListener: (() => void) | null = null;
  const installing = {
    state: "installing",
    addEventListener: vi.fn((eventName: string, listener: () => void) => {
      if (eventName === "statechange") {
        stateChangeListener = listener;
      }
    }),
  };
  const registration = {
    installing,
    addEventListener: vi.fn((eventName: string, listener: () => void) => {
      if (eventName === "updatefound") {
        updateFoundListener = listener;
      }
    }),
    update: vi.fn().mockResolvedValue(undefined),
  };
  const serviceWorker = {
    controller: hasController ? {} : null,
    register: vi.fn().mockResolvedValue(registration),
    dispatchUpdateFound: () => updateFoundListener?.(),
    dispatchInstallingStateChange: () => stateChangeListener?.(),
    installing,
  };

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: serviceWorker,
  });

  return serviceWorker;
}

function deleteServiceWorkerMock() {
  delete (navigator as Navigator & { serviceWorker?: unknown }).serviceWorker;
}

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  });
}

function setInstallEnvironment(
  overrides: Partial<PwaInstallEnvironment> = {},
) {
  const environment = {
    ...baseInstallEnvironment,
    ...overrides,
  };

  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: environment.userAgent,
  });
  Object.defineProperty(navigator, "platform", {
    configurable: true,
    value: environment.platform,
  });
  Object.defineProperty(navigator, "maxTouchPoints", {
    configurable: true,
    value: environment.maxTouchPoints,
  });
  Object.defineProperty(navigator, "standalone", {
    configurable: true,
    value: environment.standaloneNavigator,
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches:
        query === "(display-mode: standalone)" &&
        environment.standaloneDisplayMode,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function createBeforeInstallPromptEvent(outcome: "accepted" | "dismissed") {
  const event = new Event("beforeinstallprompt", {
    cancelable: true,
  }) as Event & {
    prompt: ReturnType<typeof vi.fn<() => Promise<void>>>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  };

  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({
    outcome,
    platform: "web",
  });

  return event;
}
