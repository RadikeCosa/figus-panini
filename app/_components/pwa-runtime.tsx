"use client";

import { useEffect, useRef, useState } from "react";

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
  const [installHelpDismissed, setInstallHelpDismissed] = useState(false);
  const serviceWorkerRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const updateReloadRequestedRef = useRef(false);

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

    function markUpdateAvailable(worker: ServiceWorker | null) {
      if (!navigator.serviceWorker.controller) {
        return;
      }

      waitingWorkerRef.current = worker;
      setUpdateAvailable(true);
    }

    function handleControllerChange() {
      if (updateReloadRequestedRef.current) {
        window.location.reload();
        return;
      }

      if (navigator.serviceWorker.controller) {
        setUpdateAvailable(true);
      }
    }

    async function registerServiceWorker() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        if (!active) {
          return;
        }

        serviceWorkerRegistrationRef.current = registration;

        if (registration.waiting) {
          markUpdateAvailable(registration.waiting);
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
              markUpdateAvailable(installingWorker);
            }
          });
        });

        void registration.update().catch(() => undefined);
      } catch {
        // La PWA es mejora progresiva: si el registro falla, la app sigue usable.
      }
    }

    void registerServiceWorker();
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
    };
  }, [registrationEnabled]);

  useEffect(() => {
    const environmentTimer = window.setTimeout(() => {
      setInstallEnvironment(getPwaInstallEnvironment());
    }, 0);

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallHelpDismissed(false);
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

  function applyUpdate() {
    updateReloadRequestedRef.current = true;
    const waitingWorker =
      waitingWorkerRef.current ?? serviceWorkerRegistrationRef.current?.waiting;

    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
      return;
    }

    window.location.reload();
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
  const showInstallHelp =
    !installHelpDismissed &&
    (showInstallPrompt || showIosHelp || showAndroidMenuHelp);
  const showOperationalNotice = isOffline || updateAvailable;

  if (!showOperationalNotice && !showInstallHelp) {
    return null;
  }

  const installHelpContent = showInstallHelp ? (
    <PwaInstallHelp
      showAndroidMenuHelp={showAndroidMenuHelp}
      showInstallPrompt={showInstallPrompt}
      showIosHelp={showIosHelp}
      onClose={() => setInstallHelpDismissed(true)}
      onInstall={() => void installApp()}
    />
  ) : null;

  if (!showOperationalNotice) {
    return (
      <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div
          aria-live="polite"
          className="mx-auto max-w-md rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-3 text-sm text-white shadow-lg"
          role="status"
        >
          {installHelpContent}
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-50 flex justify-center">
      <div
        aria-live="polite"
        className="pointer-events-auto flex max-h-[min(45dvh,18rem)] max-w-md flex-col gap-3 overflow-y-auto rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-3 text-sm text-white shadow-lg"
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
              onClick={applyUpdate}
            >
              Actualizar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PwaInstallHelp({
  showAndroidMenuHelp,
  showInstallPrompt,
  showIosHelp,
  onClose,
  onInstall,
}: {
  showAndroidMenuHelp: boolean;
  showInstallPrompt: boolean;
  showIosHelp: boolean;
  onClose: () => void;
  onInstall: () => void;
}) {
  if (showInstallPrompt) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Usar como app</p>
          <p className="text-emerald-50">
            Acceso rápido desde el inicio y uso offline después de cargarla.
          </p>
        </div>
        <button
          className="min-h-11 rounded-md bg-white px-4 font-semibold text-emerald-950 outline-offset-2 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          type="button"
          onClick={onInstall}
        >
          Instalar app
        </button>
        <CloseInstallHelpButton label="Cerrar aviso de instalación" onClose={onClose} />
      </div>
    );
  }

  if (showIosHelp) {
    return (
      <div className="grid gap-3">
        <div>
          <p className="font-semibold">Cómo agregarla</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-emerald-50">
            <li>Tocá Compartir.</li>
            <li>Elegí Agregar a pantalla de inicio.</li>
            <li>Tocá Agregar.</li>
          </ol>
        </div>
        <CloseInstallHelpButton label="Cerrar ayuda de instalación" onClose={onClose} />
      </div>
    );
  }

  if (showAndroidMenuHelp) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1">
          También podés instalarla desde el menú del navegador.
        </p>
        <CloseInstallHelpButton label="Cerrar ayuda de instalación" onClose={onClose} />
      </div>
    );
  }

  return null;
}

function CloseInstallHelpButton({
  label,
  onClose,
}: {
  label: string;
  onClose: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="min-h-11 rounded-md border border-emerald-700 px-3 font-semibold text-emerald-50 outline-offset-2 hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      type="button"
      onClick={onClose}
    >
      Cerrar
    </button>
  );
}
