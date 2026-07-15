"use client";

import { useEffect, useState } from "react";

export type ServiceWorkerRegistrationEnvironment = {
  nodeEnv: string | undefined;
  hasNavigator: boolean;
  hasServiceWorker: boolean;
  protocol: string | undefined;
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

type PwaRuntimeProps = {
  registrationEnabled?: boolean;
};

export function PwaRuntime({
  registrationEnabled = shouldRegisterServiceWorker(),
}: PwaRuntimeProps) {
  const [isOffline, setIsOffline] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

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

  if (!isOffline && !updateAvailable) {
    return null;
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 flex justify-center pointer-events-none">
      <div
        aria-live="polite"
        className="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-3 text-sm text-white shadow-lg"
        role="status"
      >
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
    </div>
  );
}
