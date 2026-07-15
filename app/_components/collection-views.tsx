"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildAlbumSectionHref,
  buildDuplicateCollectionView,
  buildMissingCollectionView,
  listCollectionSectionOptions,
  type DuplicateSectionView,
  type MissingSectionView,
} from "../../domain/collection/collection-views";
import type { CollectionState } from "../../domain/collection/collection";
import type { CollectionRepository } from "../../infrastructure/persistence/collection-repository";
import { createBrowserCollectionRepository } from "../repositories/browser-collection-repository";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; collection: CollectionState }
  | { status: "error" };

type CollectionViewMode = "missing" | "duplicates";

type CollectionViewsProps = {
  mode: CollectionViewMode;
  createRepository?: () => CollectionRepository;
};

const SECTION_OPTIONS = listCollectionSectionOptions();
const ALL_SECTIONS = "all";

export function CollectionViews({
  mode,
  createRepository = createBrowserCollectionRepository,
}: CollectionViewsProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [selectedSection, setSelectedSection] = useState(ALL_SECTIONS);

  const loadCollection = useCallback(async () => {
    try {
      const repository = createRepository();
      const collection = await repository.load();
      setLoadState({ status: "ready", collection });
    } catch {
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
      } catch {
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

  const copy = getViewCopy(mode);

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
          <p className="mt-4 text-sm font-medium text-emerald-100">
            {copy.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{copy.title}</h1>
          <p className="mt-3 text-sm leading-6 text-emerald-50">
            {copy.description}
          </p>
        </header>

        {loadState.status === "loading" ? (
          <CollectionViewLoading label={copy.loadingLabel} />
        ) : null}
        {loadState.status === "error" ? (
          <CollectionViewError label={copy.errorLabel} onRetry={retryLoadCollection} />
        ) : null}
        {loadState.status === "ready" ? (
          <CollectionViewReady
            collection={loadState.collection}
            mode={mode}
            selectedSection={selectedSection}
            onSelectSection={setSelectedSection}
          />
        ) : null}
      </div>
    </main>
  );
}

function CollectionViewReady({
  collection,
  mode,
  selectedSection,
  onSelectSection,
}: {
  collection: CollectionState;
  mode: CollectionViewMode;
  selectedSection: string;
  onSelectSection: (section: string) => void;
}) {
  if (mode === "missing") {
    return (
      <MissingView
        collection={collection}
        selectedSection={selectedSection}
        onSelectSection={onSelectSection}
      />
    );
  }

  return (
    <DuplicatesView
      collection={collection}
      selectedSection={selectedSection}
      onSelectSection={onSelectSection}
    />
  );
}

function MissingView({
  collection,
  selectedSection,
  onSelectSection,
}: {
  collection: CollectionState;
  selectedSection: string;
  onSelectSection: (section: string) => void;
}) {
  const view = useMemo(() => buildMissingCollectionView(collection), [collection]);
  const sections = filterSections(view.sections, selectedSection);
  const isFiltered = selectedSection !== ALL_SECTIONS;

  return (
    <section aria-labelledby="missing-title" className="space-y-4">
      <SummaryPanel>
        <p className="text-sm font-medium text-emerald-700">Faltantes</p>
        <h2 id="missing-title" className="mt-2 text-3xl font-bold text-zinc-950">
          {view.totalMissing} faltantes
        </h2>
        <p className="mt-2 text-sm font-semibold text-zinc-700">
          {view.progress.owned} de {view.progress.total} pegadas
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          {view.totalMissing === 980
            ? "Tu colección guardada está vacía."
            : "Listado derivado de la colección guardada."}
        </p>
      </SummaryPanel>

      <SectionFilter
        label="Filtrar faltantes por sección"
        selectedSection={selectedSection}
        onSelectSection={onSelectSection}
      />

      {view.totalMissing === 0 ? (
        <EmptyState message="No te falta ninguna figurita." />
      ) : sections.length === 0 ? (
        <EmptyState message="Ese filtro no tiene figuritas faltantes." />
      ) : (
        <SectionList>
          {sections.map((section) => (
            <MissingSectionCard key={section.section} section={section} />
          ))}
        </SectionList>
      )}

      {isFiltered && view.totalMissing > 0 ? (
        <p className="text-sm font-medium text-zinc-600" aria-live="polite">
          Filtro activo: {selectedSection}
        </p>
      ) : null}
    </section>
  );
}

function DuplicatesView({
  collection,
  selectedSection,
  onSelectSection,
}: {
  collection: CollectionState;
  selectedSection: string;
  onSelectSection: (section: string) => void;
}) {
  const view = useMemo(() => buildDuplicateCollectionView(collection), [collection]);
  const sections = filterSections(view.sections, selectedSection);
  const isFiltered = selectedSection !== ALL_SECTIONS;

  return (
    <section aria-labelledby="duplicates-title" className="space-y-4">
      <SummaryPanel>
        <p className="text-sm font-medium text-amber-700">Repetidas</p>
        <h2 id="duplicates-title" className="mt-2 text-3xl font-bold text-zinc-950">
          {view.duplicateCopyCount} copias repetidas
        </h2>
        <p className="mt-2 text-sm font-semibold text-zinc-700">
          {view.duplicatePositionCount} posiciones con repetidas
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          Las copias repetidas son las que sobran después de la primera.
        </p>
      </SummaryPanel>

      <SectionFilter
        label="Filtrar repetidas por sección"
        selectedSection={selectedSection}
        onSelectSection={onSelectSection}
      />

      {view.duplicateCopyCount === 0 ? (
        <EmptyState message="No tenés figuritas repetidas." />
      ) : sections.length === 0 ? (
        <EmptyState message="Ese filtro no tiene figuritas repetidas." />
      ) : (
        <SectionList>
          {sections.map((section) => (
            <DuplicateSectionCard key={section.section} section={section} />
          ))}
        </SectionList>
      )}

      {isFiltered && view.duplicateCopyCount > 0 ? (
        <p className="text-sm font-medium text-zinc-600" aria-live="polite">
          Filtro activo: {selectedSection}
        </p>
      ) : null}
    </section>
  );
}

function SectionFilter({
  label,
  selectedSection,
  onSelectSection,
}: {
  label: string;
  selectedSection: string;
  onSelectSection: (section: string) => void;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <label className="block text-sm font-semibold text-zinc-800" htmlFor="section-filter">
        {label}
      </label>
      <select
        className="mt-2 min-h-12 w-full rounded-md border border-zinc-300 bg-white px-3 text-base font-semibold text-zinc-950 outline-offset-2 focus:border-emerald-700 focus:outline focus:outline-2 focus:outline-emerald-700"
        id="section-filter"
        value={selectedSection}
        onChange={(event) => onSelectSection(event.target.value)}
      >
        <option value={ALL_SECTIONS}>Todas las secciones</option>
        <optgroup label="Especiales">
          {SECTION_OPTIONS.filter((option) => option.type === "special").map(
            ({ section }) => (
              <option key={section} value={section}>
                {section}
              </option>
            ),
          )}
        </optgroup>
        {groupSelectionOptions().map(({ group, sections }) => (
          <optgroup key={group} label={group}>
            {sections.map((section) => (
              <option key={section} value={section}>
                {section}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </section>
  );
}

function MissingSectionCard({ section }: { section: MissingSectionView }) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-700">
            {section.group}
          </p>
          <h3 className="mt-1 text-xl font-bold text-zinc-950">{section.section}</h3>
          <p className="mt-1 text-sm font-semibold text-zinc-700">
            {section.missing} faltantes · {section.owned} de {section.total} pegadas
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {section.percentage}% de esta sección
          </p>
        </div>
        <AlbumSectionLink section={section.section} />
      </div>
      <PositionPills positions={section.positions.map(({ position }) => position)} />
    </article>
  );
}

function DuplicateSectionCard({ section }: { section: DuplicateSectionView }) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-amber-700">
            {section.group}
          </p>
          <h3 className="mt-1 text-xl font-bold text-zinc-950">{section.section}</h3>
          <p className="mt-1 text-sm font-semibold text-zinc-700">
            {section.duplicatePositionCount} posiciones ·{" "}
            {section.duplicateCopyCount} copias repetidas
          </p>
        </div>
        <AlbumSectionLink section={section.section} />
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {section.positions.map((position) => (
          <li
            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
            key={`${position.section}-${position.position}`}
          >
            <span className="font-bold text-amber-950">
              {position.section} {position.position}
            </span>
            <span className="block font-medium text-amber-900">
              {position.copies} copias totales · {position.duplicateCopies} repetidas
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function PositionPills({ positions }: { positions: string[] }) {
  return (
    <ol className="mt-4 flex flex-wrap gap-2" aria-label="Posiciones">
      {positions.map((position) => (
        <li
          className="min-w-10 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-center text-sm font-bold text-zinc-800"
          key={position}
        >
          {position}
        </li>
      ))}
    </ol>
  );
}

function AlbumSectionLink({ section }: { section: string }) {
  return (
    <Link
      className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-950 outline-offset-2 transition hover:border-emerald-700 hover:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
      href={buildAlbumSectionHref(section)}
    >
      Ver en álbum
    </Link>
  );
}

function SummaryPanel({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      {children}
    </section>
  );
}

function SectionList({ children }: { children: ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <section
      aria-live="polite"
      className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <p className="text-lg font-semibold text-zinc-950">{message}</p>
    </section>
  );
}

function CollectionViewLoading({ label }: { label: string }) {
  return (
    <section
      aria-live="polite"
      className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <p className="text-sm font-medium text-zinc-500">Cargando colección</p>
      <p className="mt-2 text-lg font-semibold text-zinc-950">{label}</p>
    </section>
  );
}

function CollectionViewError({
  label,
  onRetry,
}: {
  label: string;
  onRetry: () => void;
}) {
  return (
    <section
      aria-live="assertive"
      className="rounded-lg border border-red-200 bg-red-50 p-5 shadow-sm"
      role="alert"
    >
      <h2 className="text-lg font-semibold text-red-950">{label}</h2>
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

function filterSections<TSection extends { section: string }>(
  sections: TSection[],
  selectedSection: string,
): TSection[] {
  if (selectedSection === ALL_SECTIONS) {
    return sections;
  }

  return sections.filter((section) => section.section === selectedSection);
}

function groupSelectionOptions() {
  const groups: Array<{ group: string; sections: string[] }> = [];

  for (const option of SECTION_OPTIONS) {
    if (option.type !== "selection") {
      continue;
    }

    const group = groups.find((current) => current.group === option.group);
    if (group) {
      group.sections.push(option.section);
    } else {
      groups.push({ group: option.group, sections: [option.section] });
    }
  }

  return groups;
}

function getViewCopy(mode: CollectionViewMode) {
  if (mode === "missing") {
    return {
      eyebrow: "Faltantes",
      title: "Figuritas faltantes",
      description: "Revisá qué posiciones todavía no están guardadas.",
      loadingLabel: "Calculando faltantes...",
      errorLabel: "No fue posible cargar faltantes",
    };
  }

  return {
    eyebrow: "Repetidas",
    title: "Figuritas repetidas",
    description: "Encontrá las copias disponibles para cambiar.",
    loadingLabel: "Calculando repetidas...",
    errorLabel: "No fue posible cargar repetidas",
  };
}
