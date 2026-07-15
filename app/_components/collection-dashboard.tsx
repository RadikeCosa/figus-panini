"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getDuplicateCopyCount,
  getGlobalProgress,
  getUniqueOwnedCount,
  listMissingPositions,
  type CollectionState,
} from "../../domain/collection/collection";
import type { CollectionRepository } from "../../infrastructure/persistence/collection-repository";
import { createBrowserCollectionRepository } from "../repositories/browser-collection-repository";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; collection: CollectionState }
  | { status: "error" };

type CollectionDashboardProps = {
  createRepository?: () => CollectionRepository;
};

export function CollectionDashboard({
  createRepository = createBrowserCollectionRepository,
}: CollectionDashboardProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  const loadCollection = useCallback(async () => {
    try {
      const repository = createRepository();
      const collection = await repository.load();
      setLoadState({ status: "ready", collection });
    } catch (error) {
      console.error("No fue posible cargar la colección.", error);
      setLoadState({ status: "error" });
    }
  }, [createRepository]);

  useEffect(() => {
    let active = true;

    async function loadInitialCollection() {
      try {
        const repository = createRepository();
        const collection = await repository.load();

        if (active) {
          setLoadState({ status: "ready", collection });
        }
      } catch (error) {
        console.error("No fue posible cargar la colección.", error);

        if (active) {
          setLoadState({ status: "error" });
        }
      }
    }

    void loadInitialCollection();

    return () => {
      active = false;
    };
  }, [createRepository]);

  const retryLoadCollection = useCallback(() => {
    setLoadState({ status: "loading" });
    void loadCollection();
  }, [loadCollection]);

  if (loadState.status === "loading") {
    return (
      <section
        aria-live="polite"
        className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
      >
        <p className="text-sm font-medium text-zinc-500">Cargando colección</p>
        <p className="mt-2 text-lg font-semibold text-zinc-950">
          Abriendo el álbum guardado...
        </p>
      </section>
    );
  }

  if (loadState.status === "error") {
    return (
      <section
        aria-live="assertive"
        className="rounded-lg border border-red-200 bg-red-50 p-5 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-red-950">
          No fue posible cargar la colección
        </h2>
        <p className="mt-2 text-sm text-red-800">
          Revisá el navegador e intentá nuevamente.
        </p>
        <button
          className="mt-4 min-h-11 rounded-md bg-red-900 px-4 py-2 text-sm font-semibold text-white outline-offset-2 transition hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-900"
          type="button"
          onClick={retryLoadCollection}
        >
          Reintentar
        </button>
      </section>
    );
  }

  return <ReadySummary collection={loadState.collection} />;
}

function ReadySummary({ collection }: { collection: CollectionState }) {
  const metrics = useMemo(() => {
    const progress = getGlobalProgress(collection);
    const owned = getUniqueOwnedCount(collection);
    const missing = listMissingPositions(collection).length;
    const duplicates = getDuplicateCopyCount(collection);
    const percentage =
      progress.total === 0 ? 0 : Math.round((progress.owned / progress.total) * 100);

    return {
      progress,
      owned,
      missing,
      duplicates,
      percentage,
    };
  }, [collection]);

  return (
    <section aria-labelledby="summary-title" className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-zinc-500">Progreso</p>
        <h2 id="summary-title" className="mt-2 text-4xl font-bold text-zinc-950">
          {metrics.progress.owned} / {metrics.progress.total}
        </h2>
        <div className="mt-4 h-3 rounded-full bg-zinc-100" aria-hidden="true">
          <div
            className="h-3 rounded-full bg-emerald-600"
            style={{ width: `${metrics.percentage}%` }}
          />
        </div>
        <p className="mt-3 text-sm font-medium text-zinc-600">
          {metrics.percentage}% completado
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <MetricCard label="Pegadas" value={metrics.owned} />
        <MetricCard label="Faltantes" value={metrics.missing} />
        <MetricCard label="Repetidas" value={metrics.duplicates} />
        <MetricCard label="Total" value={metrics.progress.total} />
      </dl>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <dt className="text-sm font-medium text-zinc-500">{label}</dt>
      <dd className="mt-2 text-2xl font-bold text-zinc-950">{value}</dd>
    </div>
  );
}
