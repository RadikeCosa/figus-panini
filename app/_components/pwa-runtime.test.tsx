/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PwaRuntime,
  shouldRegisterServiceWorker,
  type ServiceWorkerRegistrationEnvironment,
} from "./pwa-runtime";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setNavigatorOnline(true);
  deleteServiceWorkerMock();
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
});

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
