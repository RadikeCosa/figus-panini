"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SELECTION_GROUPS,
  SPECIAL_SECTIONS,
  expandCanonicalAlbumPositions,
} from "../../../domain/album/canonical-album";
import {
  addCopy,
  getCopies,
  getDuplicateCopies,
  getSectionProgress,
  removeCopy,
  resolveCanonicalSection,
  type AlbumPosition,
  type CollectionState,
} from "../../../domain/collection/collection";
import type { CollectionRepository } from "../../../infrastructure/persistence/collection-repository";
import { createBrowserCollectionRepository } from "../../repositories/browser-collection-repository";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; collection: CollectionState }
  | { status: "error" };

type SaveState = "idle" | "saving" | "saved" | "error";

type SectionOption = {
  section: string;
  group: string;
  type: "special" | "selection";
};

type AlbumBrowserProps = {
  createRepository?: () => CollectionRepository;
  initialSection?: string;
};

const INITIAL_SECTION = "PANINI";
const CANONICAL_POSITIONS = expandCanonicalAlbumPositions();
const SECTION_OPTIONS: SectionOption[] = [
  ...SPECIAL_SECTIONS.map(({ section }) => ({
    section,
    group: "Especiales",
    type: "special" as const,
  })),
  ...SELECTION_GROUPS.flatMap(({ group, sections }) =>
    sections.map((section) => ({
      section,
      group,
      type: "selection" as const,
    })),
  ),
];

export function AlbumBrowser({
  createRepository = createBrowserCollectionRepository,
  initialSection,
}: AlbumBrowserProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [selectedSection, setSelectedSection] = useState(() =>
    resolveInitialSection(readVisibleAlbumSection() ?? initialSection),
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isSaving, setIsSaving] = useState(false);
  const repositoryRef = useRef<CollectionRepository | null>(null);
  const collectionRef = useRef<CollectionState | null>(null);
  const savingRef = useRef(false);

  const loadCollection = useCallback(async () => {
    try {
      const repository = createRepository();
      repositoryRef.current = repository;
      const collection = await repository.load();
      collectionRef.current = collection;
      setLoadState({ status: "ready", collection });
      setSaveState("idle");
    } catch (error) {
      console.error("No fue posible cargar la colección.", error);
      collectionRef.current = null;
      setLoadState({ status: "error" });
      setSaveState("idle");
    }
  }, [createRepository]);

  useEffect(() => {
    let active = true;

    async function loadInitialCollection() {
      try {
        const repository = createRepository();
        repositoryRef.current = repository;
        const collection = await repository.load();

        if (active) {
          collectionRef.current = collection;
          setLoadState({ status: "ready", collection });
          setSaveState("idle");
        }
      } catch (error) {
        console.error("No fue posible cargar la colección.", error);

        if (active) {
          collectionRef.current = null;
          setLoadState({ status: "error" });
          setSaveState("idle");
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

  const changeCopies = useCallback(
    async (
      position: AlbumPosition,
      operation: (collection: CollectionState, position: AlbumPosition) => CollectionState,
    ) => {
      const repository = repositoryRef.current;
      const previousCollection = collectionRef.current;

      if (!repository || !previousCollection || savingRef.current) {
        return;
      }

      const nextCollection = operation(previousCollection, position);

      savingRef.current = true;
      collectionRef.current = nextCollection;
      setIsSaving(true);
      setSaveState("saving");
      setLoadState({ status: "ready", collection: nextCollection });

      try {
        await repository.save(nextCollection);
        setSaveState("saved");
      } catch {
        collectionRef.current = previousCollection;
        setLoadState({ status: "ready", collection: previousCollection });
        setSaveState("error");
      } finally {
        savingRef.current = false;
        setIsSaving(false);
      }
    },
    [],
  );

  return (
    <main className="min-h-dvh bg-zinc-50 px-4 py-5 text-zinc-950">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <header className="rounded-lg bg-emerald-900 px-5 py-6 text-white shadow-sm">
          <Link
            className="inline-flex min-h-10 items-center rounded-md px-1 text-sm font-semibold text-emerald-50 underline-offset-4 outline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            href="/"
          >
            Volver al inicio
          </Link>
          <p className="mt-4 text-sm font-medium text-emerald-100">Álbum</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Recorrido por secciones
          </h1>
          <p className="mt-3 text-sm leading-6 text-emerald-50">
            Revisá y corregí cantidades guardadas en este navegador.
          </p>
        </header>

        {loadState.status === "loading" ? <AlbumLoading /> : null}
        {loadState.status === "error" ? (
          <AlbumLoadError onRetry={retryLoadCollection} />
        ) : null}
        {loadState.status === "ready" ? (
          <AlbumReady
            collection={loadState.collection}
            isSaving={isSaving}
            onAddCopy={(position) => void changeCopies(position, addCopy)}
            onRemoveCopy={(position) => void changeCopies(position, removeCopy)}
            selectedSection={selectedSection}
            saveState={saveState}
            onSelectSection={setSelectedSection}
          />
        ) : null}
      </div>
    </main>
  );
}

function resolveInitialSection(section: string | undefined): string {
  if (!section) {
    return INITIAL_SECTION;
  }

  const resolved = resolveCanonicalSection(section);
  return resolved.status === "found" ? resolved.section : INITIAL_SECTION;
}

function readVisibleAlbumSection(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return new URLSearchParams(window.location.search).get("section") ?? undefined;
}

function AlbumLoading() {
  return (
    <section
      aria-live="polite"
      className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <p className="text-sm font-medium text-zinc-500">Cargando álbum</p>
      <p className="mt-2 text-lg font-semibold text-zinc-950">
        Abriendo la colección guardada...
      </p>
    </section>
  );
}

function AlbumLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <section
      aria-live="assertive"
      className="rounded-lg border border-red-200 bg-red-50 p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-red-950">
        No fue posible cargar el álbum
      </h2>
      <p className="mt-2 text-sm text-red-800">
        Revisá el navegador e intentá nuevamente.
      </p>
      <button
        className="mt-4 min-h-11 rounded-md bg-red-900 px-4 py-2 text-sm font-semibold text-white outline-offset-2 transition hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-900"
        type="button"
        onClick={onRetry}
      >
        Reintentar
      </button>
    </section>
  );
}

function AlbumReady({
  collection,
  isSaving,
  onAddCopy,
  onRemoveCopy,
  selectedSection,
  saveState,
  onSelectSection,
}: {
  collection: CollectionState;
  isSaving: boolean;
  onAddCopy: (position: AlbumPosition) => void;
  onRemoveCopy: (position: AlbumPosition) => void;
  selectedSection: string;
  saveState: SaveState;
  onSelectSection: (section: string) => void;
}) {
  const selectedOption = SECTION_OPTIONS.find(
    (option) => option.section === selectedSection,
  );
  const sectionPositions = useMemo(
    () =>
      CANONICAL_POSITIONS.filter(
        (position) => position.section === selectedSection,
      ),
    [selectedSection],
  );

  return (
    <section aria-labelledby="album-section-title" className="space-y-4">
      <SectionSelector
        selectedSection={selectedSection}
        onSelectSection={onSelectSection}
      />

      <SaveStatus state={saveState} />

      <SectionHeader
        collection={collection}
        group={selectedOption?.group ?? "Especiales"}
        positions={sectionPositions}
        section={selectedSection}
      />

      <PositionGrid
        collection={collection}
        isSaving={isSaving}
        positions={sectionPositions}
        onAddCopy={onAddCopy}
        onRemoveCopy={onRemoveCopy}
      />
    </section>
  );
}

function SaveStatus({ state }: { state: SaveState }) {
  if (state === "idle") {
    return null;
  }

  const message =
    state === "saving"
      ? "Guardando cambios..."
      : state === "saved"
        ? "Cambios guardados."
        : "No fue posible guardar. Se restauró el estado anterior.";

  return (
    <p
      aria-live={state === "error" ? "assertive" : "polite"}
      className={`rounded-lg border px-4 py-3 text-sm font-semibold shadow-sm ${
        state === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
      role={state === "error" ? "alert" : "status"}
    >
      {message}
    </p>
  );
}

function SectionSelector({
  selectedSection,
  onSelectSection,
}: {
  selectedSection: string;
  onSelectSection: (section: string) => void;
}) {
  return (
    <nav
      aria-label="Navegación de secciones del álbum"
      className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
    >
      <label className="block text-sm font-semibold text-zinc-800" htmlFor="album-section">
        Sección del álbum
      </label>
      <select
        className="mt-2 min-h-12 w-full rounded-md border border-zinc-300 bg-white px-3 text-base font-semibold text-zinc-950 outline-offset-2 focus:border-emerald-700 focus:outline focus:outline-2 focus:outline-emerald-700"
        id="album-section"
        value={selectedSection}
        onChange={(event) => onSelectSection(event.target.value)}
      >
        <optgroup label="Especiales">
          {SPECIAL_SECTIONS.map(({ section }) => (
            <option key={section} value={section}>
              {section}
            </option>
          ))}
        </optgroup>
        {SELECTION_GROUPS.map(({ group, sections }) => (
          <optgroup key={group} label={group}>
            {sections.map((section) => (
              <option key={section} value={section}>
                {section}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </nav>
  );
}

function SectionHeader({
  collection,
  group,
  positions,
  section,
}: {
  collection: CollectionState;
  group: string;
  positions: AlbumPosition[];
  section: string;
}) {
  const progress = getSectionProgress(collection, section);
  const duplicateCopies = positions.reduce(
    (total, position) => total + getDuplicateCopies(collection, position),
    0,
  );
  const missing = progress.total - progress.owned;
  const percentage =
    progress.total === 0 ? 0 : Math.round((progress.owned / progress.total) * 100);

  return (
    <section
      aria-labelledby="album-section-title"
      className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <p className="text-sm font-medium text-emerald-700">{group}</p>
      <h2 id="album-section-title" className="mt-2 text-3xl font-bold text-zinc-950">
        {section}
      </h2>
      <p className="mt-2 text-sm font-medium text-zinc-600">
        {progress.owned} de {progress.total} pegadas · {missing} faltantes ·{" "}
        {duplicateCopies} repetidas
      </p>
      <div className="mt-4 h-3 rounded-full bg-zinc-100" aria-hidden="true">
        <div
          className="h-3 rounded-full bg-emerald-600"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="mt-3 text-sm font-semibold text-zinc-700">
        {percentage}% de esta sección
      </p>
    </section>
  );
}

function PositionGrid({
  collection,
  isSaving,
  onAddCopy,
  onRemoveCopy,
  positions,
}: {
  collection: CollectionState;
  isSaving: boolean;
  onAddCopy: (position: AlbumPosition) => void;
  onRemoveCopy: (position: AlbumPosition) => void;
  positions: AlbumPosition[];
}) {
  return (
    <section
      aria-labelledby="album-grid-title"
      className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
    >
      <h3 id="album-grid-title" className="text-base font-semibold text-zinc-950">
        Posiciones
      </h3>
      <ol className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,8.625rem),1fr))] gap-3">
        {positions.map((position) => (
          <li className="min-w-0" key={`${position.section}-${position.position}`}>
            <PositionCard
              collection={collection}
              isSaving={isSaving}
              position={position}
              onAddCopy={onAddCopy}
              onRemoveCopy={onRemoveCopy}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

function PositionCard({
  collection,
  isSaving,
  onAddCopy,
  onRemoveCopy,
  position,
}: {
  collection: CollectionState;
  isSaving: boolean;
  onAddCopy: (position: AlbumPosition) => void;
  onRemoveCopy: (position: AlbumPosition) => void;
  position: AlbumPosition;
}) {
  const copies = getCopies(collection, position);
  const duplicateCopies = getDuplicateCopies(collection, position);
  const state =
    copies === 0 ? "missing" : duplicateCopies > 0 ? "duplicate" : "owned";
  const stateLabel =
    state === "missing"
      ? "Faltante"
      : state === "duplicate"
        ? `${duplicateCopies} repetida${duplicateCopies === 1 ? "" : "s"}`
        : "Pegada";
  const quantityLabel = `${copies} copia${copies === 1 ? "" : "s"}`;
  const stateStyles =
    state === "missing"
      ? "border-zinc-200 bg-zinc-50 text-zinc-700"
      : state === "duplicate"
        ? "border-amber-300 bg-amber-50 text-amber-950"
        : "border-emerald-300 bg-emerald-50 text-emerald-950";

  return (
    <article
      aria-label={`${position.section} ${position.position}: ${stateLabel}, ${quantityLabel}`}
      className={`flex h-full min-w-0 flex-col gap-3 rounded-md border p-3 ${stateStyles}`}
    >
      <div className="min-w-0">
        <p className="text-3xl font-bold leading-none text-zinc-950">
          {position.position}
        </p>
        <p className="mt-2 min-h-5 text-sm font-semibold text-zinc-700">
          {stateLabel}
        </p>
      </div>
      <div className="mt-auto min-w-0 rounded-md border border-zinc-200 bg-white p-2">
        <p
          className="min-w-0 text-sm font-semibold text-zinc-800"
          aria-label={`${quantityLabel} registrada${copies === 1 ? "" : "s"}`}
          aria-live="polite"
        >
          Cantidad: <span className="text-base text-zinc-950">{copies}</span>
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            aria-label={`Quitar copia de ${position.section} ${position.position}`}
            className="min-h-11 min-w-0 rounded-md border border-zinc-300 bg-white text-lg font-bold text-zinc-950 outline-offset-2 transition hover:border-red-500 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
            disabled={copies === 0 || isSaving}
            type="button"
            onClick={() => onRemoveCopy(position)}
          >
            −
          </button>
          <button
            aria-label={`Agregar copia de ${position.section} ${position.position}`}
            className="min-h-11 min-w-0 rounded-md border border-zinc-300 bg-white text-lg font-bold text-zinc-950 outline-offset-2 transition hover:border-emerald-600 hover:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
            disabled={isSaving}
            type="button"
            onClick={() => onAddCopy(position)}
          >
            +
          </button>
        </div>
      </div>
    </article>
  );
}
