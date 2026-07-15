"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

type BeforeInstallPromptEvent = Event & {
  platforms?: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptChoice>;
};

export type ServiceWorkerRegistrationEnvironment = {
  nodeEnv: string | undefined;
  hasNavigator: boolean;
  hasServiceWorker: boolean;
  protocol: string | undefined;
};

export type PwaInstallEnvironment = {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  standaloneNavigator: boolean;
  standaloneDisplayMode: boolean;
};

export function getServiceWorkerRegistrationEnvironment(): ServiceWorkerRegistrationEnvironment {
  return {
    nodeEnv: process.env.NODE_ENV,
    hasNavigator: typeof navigator !== "undefined",
    hasServiceWorker: typeof navigator !== "undefined" && "serviceWorker" in navigator,
    protocol: typeof window !== "undefined" ? window.location.protocol : undefined,
  };
}

export function shouldRegisterServiceWorker(
  environment: ServiceWorkerRegistrationEnvironment = getServiceWorkerRegistrationEnvironment(),
) {
  return (
    environment.nodeEnv === "production" &&
    environment.hasNavigator &&
    environment.hasServiceWorker &&
    (environment.protocol === "https:" || environment.protocol === "http:")
  );
}

export function getPwaInstallEnvironment(): PwaInstallEnvironment | null {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return null;
  }

  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standaloneNavigator:
      "standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    standaloneDisplayMode:
      "matchMedia" in window &&
      window.matchMedia("(display-mode: standalone)").matches,
  };
}

export function isIosOrIpadOs(environment: PwaInstallEnvironment) {
  const userAgent = environment.userAgent.toLowerCase();
  const iPhoneOrIpad = /iphone|ipad|ipod/.test(userAgent);
  const iPadOsDesktopUa =
    environment.platform === "MacIntel" && environment.maxTouchPoints > 1;

  return iPhoneOrIpad || iPadOsDesktopUa;
}

export function isAndroidChromiumLike(environment: PwaInstallEnvironment) {
  const userAgent = environment.userAgent.toLowerCase();
  const isAndroid = userAgent.includes("android");
  const isChromium =
    userAgent.includes("chrome") ||
    userAgent.includes("chromium") ||
    userAgent.includes("crios") ||
    userAgent.includes("edg") ||
    userAgent.includes("samsungbrowser");

  return isAndroid && isChromium;
}

export function isRunningStandalone(environment: PwaInstallEnvironment) {
  return environment.standaloneDisplayMode || environment.standaloneNavigator;
}

type PwaRuntimeProps = {
  registrationEnabled?: boolean;
};

export function PwaRuntime({
  registrationEnabled = shouldRegisterServiceWorker(),
}: PwaRuntimeProps) {
  const [isOffline, setIsOffline] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [installEnvironment, setInstallEnvironment] =
    useState<PwaInstallEnvironment | null>(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") {
      return;
    }

    function refreshOnlineState() {
      setIsOffline(!navigator.onLine);
    }

    refreshOnlineState();
    window.addEventListener("online", refreshOnlineState);
    window.addEventListener("offline", refreshOnlineState);

    return () => {
      window.removeEventListener("online", refreshOnlineState);
      window.removeEventListener("offline", refreshOnlineState);
    };
  }, []);

  useEffect(() => {
    if (!registrationEnabled || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let active = true;

    async function registerServiceWorker() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        if (!active) {
          return;
        }

        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;

          if (!installingWorker) {
            return;
          }

          installingWorker.addEventListener("statechange", () => {
            if (
              installingWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setUpdateAvailable(true);
            }
          });
        });

        void registration.update().catch(() => undefined);
      } catch {
        // La PWA es mejora progresiva: si el registro falla, la app sigue usable.
      }
    }

    void registerServiceWorker();

    return () => {
      active = false;
    };
  }, [registrationEnabled]);

  useEffect(() => {
    const environmentTimer = window.setTimeout(() => {
      setInstallEnvironment(getPwaInstallEnvironment());
    }, 0);

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setInstalled(true);
      setDeferredInstallPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.clearTimeout(environmentTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function installApp() {
    if (!deferredInstallPrompt) {
      return;
    }

    await deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setInstalled(true);
      setDeferredInstallPrompt(null);
    }
  }

  const runningStandalone =
    installed ||
    (installEnvironment ? isRunningStandalone(installEnvironment) : false);
  const showInstallPrompt = Boolean(deferredInstallPrompt) && !runningStandalone;
  const showIosHelp =
    !showInstallPrompt &&
    !runningStandalone &&
    installEnvironment !== null &&
    isIosOrIpadOs(installEnvironment);
  const showAndroidMenuHelp =
    !showInstallPrompt &&
    !runningStandalone &&
    installEnvironment !== null &&
    isAndroidChromiumLike(installEnvironment);

  if (
    !isOffline &&
    !updateAvailable &&
    !showInstallPrompt &&
    !showIosHelp &&
    !showAndroidMenuHelp
  ) {
    return null;
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 flex justify-center pointer-events-none">
      <div
        aria-live="polite"
        className="pointer-events-auto flex max-w-md flex-col gap-3 rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-3 text-sm text-white shadow-lg"
        role="status"
      >
        <div className="flex flex-wrap items-center gap-3">
          {isOffline ? (
            <p>Sin conexión · tus datos siguen disponibles en este dispositivo</p>
          ) : null}
          {updateAvailable ? (
            <button
              className="min-h-9 rounded-md bg-white px-3 font-semibold text-emerald-950 outline-offset-2 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              type="button"
              onClick={() => window.location.reload()}
            >
              Actualizar
            </button>
          ) : null}
        </div>
        {showInstallPrompt ? (
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="font-semibold">Usar como app</p>
              <p className="text-emerald-50">
                Acceso rápido desde el inicio y uso offline después de cargarla.
              </p>
            </div>
            <button
              className="min-h-11 rounded-md bg-white px-4 font-semibold text-emerald-950 outline-offset-2 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              type="button"
              onClick={() => void installApp()}
            >
              Instalar app
            </button>
          </div>
        ) : null}
        {showIosHelp ? (
          <div>
            <p className="font-semibold">Cómo agregarla</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-emerald-50">
              <li>Tocá Compartir.</li>
              <li>Elegí Agregar a pantalla de inicio.</li>
              <li>Tocá Agregar.</li>
            </ol>
          </div>
        ) : null}
        {showAndroidMenuHelp ? (
          <p>También podés instalarla desde el menú del navegador.</p>
        ) : null}
      </div>
    </div>
  );
}
