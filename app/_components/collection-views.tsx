"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildAlbumSectionHref,
  buildDuplicateCollectionView,
  buildMissingCollectionView,
  type DuplicatePositionView,
  listCollectionSectionOptions,
  type DuplicateSectionView,
  type MissingSectionView,
} from "../../domain/collection/collection-views";
import {
  getCopies,
  makePositionKey,
  removeCopy,
  setCopies,
  type CollectionState,
  type PositionRef,
} from "../../domain/collection/collection";
import type { CollectionRepository } from "../../infrastructure/persistence/collection-repository";
import { createBrowserCollectionRepository } from "../repositories/browser-collection-repository";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; collection: CollectionState }
  | { status: "error" };

type CollectionViewMode = "missing" | "duplicates";
type SaveState = "idle" | "saving" | "error";
type DuplicateFeedback =
  | {
      type: "success";
      message: string;
      detail: string;
      undo?: {
        label: string;
        collection: CollectionState;
      };
    }
  | {
      type: "error";
      message: string;
    };

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
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [feedback, setFeedback] = useState<DuplicateFeedback | null>(null);
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
      setFeedback(null);
    } catch {
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
          setFeedback(null);
        }
      } catch {
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

  const saveCollection = useCallback(
    async (
      nextCollection: CollectionState,
      options: {
        previousCollection: CollectionState;
        success: DuplicateFeedback;
        error: string;
      },
    ) => {
      const repository = repositoryRef.current;

      if (!repository || savingRef.current) {
        return;
      }

      savingRef.current = true;
      collectionRef.current = nextCollection;
      setSaveState("saving");
      setFeedback(null);
      setLoadState({ status: "ready", collection: nextCollection });

      try {
        await repository.save(nextCollection);
        setSaveState("idle");
        setFeedback(options.success);
      } catch {
        collectionRef.current = options.previousCollection;
        setLoadState({ status: "ready", collection: options.previousCollection });
        setSaveState("error");
        setFeedback({ type: "error", message: options.error });
      } finally {
        savingRef.current = false;
      }
    },
    [],
  );

  const deliverDuplicateCopy = useCallback(
    (position: PositionRef) => {
      const previousCollection = collectionRef.current;

      if (!previousCollection || savingRef.current) {
        return;
      }

      const previousCopies = getCopies(previousCollection, position);

      if (previousCopies <= 1) {
        return;
      }

      const nextCollection = removeCopy(previousCollection, position);
      const nextCopies = getCopies(nextCollection, position);
      const nextDuplicateCopies = Math.max(nextCopies - 1, 0);

      void saveCollection(nextCollection, {
        previousCollection,
        success: {
          type: "success",
          message: `${position.section} ${position.position} actualizada.`,
          detail:
            nextDuplicateCopies === 0
              ? `Ahora tenés ${nextCopies} copia y ninguna repetida.`
              : `Ahora tenés ${nextCopies} copias y ${nextDuplicateCopies} repetida${
                  nextDuplicateCopies === 1 ? "" : "s"
                }.`,
          undo: {
            label: `Deshacer entrega de ${position.section} ${position.position}`,
            collection: previousCollection,
          },
        },
        error: `No fue posible registrar la entrega de ${position.section} ${position.position}.`,
      });
    },
    [saveCollection],
  );

  const correctDuplicateQuantity = useCallback(
    (position: PositionRef, copies: number) => {
      const previousCollection = collectionRef.current;

      if (!previousCollection || savingRef.current) {
        return;
      }

      const nextCollection = setCopies(previousCollection, position, copies);
      const nextDuplicateCopies = Math.max(copies - 1, 0);

      void saveCollection(nextCollection, {
        previousCollection,
        success: {
          type: "success",
          message: `${position.section} ${position.position} corregida.`,
          detail:
            copies === 0
              ? "Ahora figura como faltante."
              : nextDuplicateCopies === 0
                ? `Ahora tenés ${copies} copia y ninguna repetida.`
                : `Ahora tenés ${copies} copias y ${nextDuplicateCopies} repetida${
                    nextDuplicateCopies === 1 ? "" : "s"
                  }.`,
        },
        error: `No fue posible corregir la cantidad de ${position.section} ${position.position}.`,
      });
    },
    [saveCollection],
  );

  const undoLastDuplicateAction = useCallback(() => {
    if (!feedback || feedback.type !== "success" || !feedback.undo) {
      return;
    }

    const currentCollection = collectionRef.current;

    if (!currentCollection || savingRef.current) {
      return;
    }

    const restoredCollection = feedback.undo.collection;

    void saveCollection(restoredCollection, {
      previousCollection: currentCollection,
      success: {
        type: "success",
        message: "Cambio deshecho.",
        detail: "La cantidad anterior volvió a quedar guardada.",
      },
      error: "No fue posible deshacer el último cambio. La colección quedó sin cambios nuevos.",
    });
  }, [feedback, saveCollection]);

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
            feedback={feedback}
            mode={mode}
            saveState={saveState}
            selectedSection={selectedSection}
            onCorrectDuplicateQuantity={correctDuplicateQuantity}
            onDeliverDuplicateCopy={deliverDuplicateCopy}
            onSelectSection={setSelectedSection}
            onUndoDuplicateAction={undoLastDuplicateAction}
          />
        ) : null}
      </div>
    </main>
  );
}

function CollectionViewReady({
  collection,
  feedback,
  mode,
  saveState,
  selectedSection,
  onCorrectDuplicateQuantity,
  onDeliverDuplicateCopy,
  onSelectSection,
  onUndoDuplicateAction,
}: {
  collection: CollectionState;
  feedback: DuplicateFeedback | null;
  mode: CollectionViewMode;
  saveState: SaveState;
  selectedSection: string;
  onCorrectDuplicateQuantity: (position: PositionRef, copies: number) => void;
  onDeliverDuplicateCopy: (position: PositionRef) => void;
  onSelectSection: (section: string) => void;
  onUndoDuplicateAction: () => void;
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
      feedback={feedback}
      saveState={saveState}
      selectedSection={selectedSection}
      onCorrectQuantity={onCorrectDuplicateQuantity}
      onDeliverCopy={onDeliverDuplicateCopy}
      onSelectSection={onSelectSection}
      onUndo={onUndoDuplicateAction}
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
  feedback,
  saveState,
  selectedSection,
  onCorrectQuantity,
  onDeliverCopy,
  onSelectSection,
  onUndo,
}: {
  collection: CollectionState;
  feedback: DuplicateFeedback | null;
  saveState: SaveState;
  selectedSection: string;
  onCorrectQuantity: (position: PositionRef, copies: number) => void;
  onDeliverCopy: (position: PositionRef) => void;
  onSelectSection: (section: string) => void;
  onUndo: () => void;
}) {
  const view = useMemo(() => buildDuplicateCollectionView(collection), [collection]);
  const sections = filterSections(view.sections, selectedSection);
  const isFiltered = selectedSection !== ALL_SECTIONS;
  const isSaving = saveState === "saving";

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
        disabled={isSaving}
        onSelectSection={onSelectSection}
      />

      <DuplicateSaveStatus
        feedback={feedback}
        isSaving={isSaving}
        onUndo={onUndo}
      />

      {view.duplicateCopyCount === 0 ? (
        <EmptyState message="No tenés figuritas repetidas." />
      ) : sections.length === 0 ? (
        <EmptyState message="Ese filtro no tiene figuritas repetidas." />
      ) : (
        <SectionList>
          {sections.map((section) => (
            <DuplicateSectionCard
              key={section.section}
              disabled={isSaving}
              section={section}
              onCorrectQuantity={onCorrectQuantity}
              onDeliverCopy={onDeliverCopy}
            />
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
  disabled = false,
  label,
  selectedSection,
  onSelectSection,
}: {
  disabled?: boolean;
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
        disabled={disabled}
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

function DuplicateSectionCard({
  disabled,
  section,
  onCorrectQuantity,
  onDeliverCopy,
}: {
  disabled: boolean;
  section: DuplicateSectionView;
  onCorrectQuantity: (position: PositionRef, copies: number) => void;
  onDeliverCopy: (position: PositionRef) => void;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);

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
          <DuplicatePositionItem
            disabled={disabled}
            editing={editingKey === makePositionKey(position)}
            key={`${position.section}-${position.position}`}
            position={position}
            onCancelEdit={() => setEditingKey(null)}
            onCorrectQuantity={(copies) => {
              onCorrectQuantity(position, copies);
              setEditingKey(null);
            }}
            onDeliverCopy={() => onDeliverCopy(position)}
            onStartEdit={() => setEditingKey(makePositionKey(position))}
          />
        ))}
      </ul>
    </article>
  );
}

function DuplicatePositionItem({
  disabled,
  editing,
  position,
  onCancelEdit,
  onCorrectQuantity,
  onDeliverCopy,
  onStartEdit,
}: {
  disabled: boolean;
  editing: boolean;
  position: DuplicatePositionView;
  onCancelEdit: () => void;
  onCorrectQuantity: (copies: number) => void;
  onDeliverCopy: () => void;
  onStartEdit: () => void;
}) {
  const [quantityInput, setQuantityInput] = useState(String(position.copies));
  const inputId = `quantity-${makePositionKey(position)}`;
  const numericQuantity =
    /^\d+$/.test(quantityInput.trim()) ? Number(quantityInput.trim()) : null;
  const hasInvalidQuantity = numericQuantity === null;
  const zeroWarning = numericQuantity === 0;

  return (
    <li className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="font-bold text-amber-950">
            {position.section} {position.position}
          </span>
          <span
            className="block font-medium text-amber-900"
            aria-label={`${position.section} ${position.position}: ${position.copies} copias totales, ${position.duplicateCopies} repetidas`}
          >
            {position.copies} copias totales · {position.duplicateCopies} repetidas
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="min-h-11 rounded-md bg-amber-800 px-3 py-2 text-sm font-semibold text-white outline-offset-2 transition hover:bg-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-600"
            type="button"
            disabled={disabled || position.copies <= 1}
            aria-label={`Registrar entrega de una repetida de ${position.section} ${position.position}`}
            onClick={onDeliverCopy}
          >
            Entregué una
          </button>
          <button
            className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-950 outline-offset-2 transition hover:border-amber-700 hover:text-amber-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-800 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
            type="button"
            disabled={disabled}
            aria-expanded={editing}
            aria-controls={editing ? inputId : undefined}
            aria-label={`Corregir cantidad de ${position.section} ${position.position}`}
            onClick={() => {
              if (editing) {
                onCancelEdit();
                return;
              }

              setQuantityInput(String(position.copies));
              onStartEdit();
            }}
          >
            {editing ? "Cerrar" : "Corregir cantidad"}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3">
          <label className="block text-sm font-semibold text-zinc-800" htmlFor={inputId}>
            Cantidad total registrada
          </label>
          <div className="mt-2 flex items-center gap-2">
            <button
              className="min-h-11 min-w-11 rounded-md border border-zinc-300 bg-white text-lg font-bold text-zinc-950 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-800 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
              type="button"
              disabled={disabled || numericQuantity === null || numericQuantity <= 0}
              aria-label={`Disminuir cantidad de ${position.section} ${position.position}`}
              onClick={() => setQuantityInput(String(Math.max((numericQuantity ?? 0) - 1, 0)))}
            >
              -
            </button>
            <input
              className="min-h-11 w-full rounded-md border border-zinc-300 px-3 text-center text-base font-semibold text-zinc-950 outline-offset-2 focus:border-amber-700 focus:outline focus:outline-2 focus:outline-amber-800"
              id={inputId}
              inputMode="numeric"
              min={0}
              pattern="[0-9]*"
              type="text"
              value={quantityInput}
              aria-invalid={hasInvalidQuantity}
              aria-describedby={zeroWarning ? `${inputId}-warning` : undefined}
              onChange={(event) => setQuantityInput(event.target.value)}
            />
            <button
              className="min-h-11 min-w-11 rounded-md border border-zinc-300 bg-white text-lg font-bold text-zinc-950 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-800 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
              type="button"
              disabled={disabled || numericQuantity === null}
              aria-label={`Aumentar cantidad de ${position.section} ${position.position}`}
              onClick={() => setQuantityInput(String((numericQuantity ?? 0) + 1))}
            >
              +
            </button>
          </div>
          {hasInvalidQuantity ? (
            <p className="mt-2 text-sm font-semibold text-red-800" role="alert">
              Ingresá una cantidad entera sin decimales.
            </p>
          ) : null}
          {zeroWarning ? (
            <p
              className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"
              id={`${inputId}-warning`}
            >
              Esta figurita quedará marcada como faltante.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="min-h-11 rounded-md bg-emerald-800 px-3 py-2 text-sm font-semibold text-white outline-offset-2 transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-600"
              type="button"
              disabled={disabled || numericQuantity === null}
              onClick={() => {
                if (numericQuantity !== null) {
                  onCorrectQuantity(numericQuantity);
                }
              }}
            >
              Guardar cantidad
            </button>
            <button
              className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-950 outline-offset-2 transition hover:border-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
              type="button"
              disabled={disabled}
              onClick={onCancelEdit}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function DuplicateSaveStatus({
  feedback,
  isSaving,
  onUndo,
}: {
  feedback: DuplicateFeedback | null;
  isSaving: boolean;
  onUndo: () => void;
}) {
  if (isSaving) {
    return (
      <p
        aria-live="polite"
        className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-sm"
        role="status"
      >
        Guardando cambios...
      </p>
    );
  }

  if (!feedback) {
    return null;
  }

  if (feedback.type === "error") {
    return (
      <p
        aria-live="assertive"
        className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 shadow-sm"
        role="alert"
      >
        {feedback.message}
      </p>
    );
  }

  return (
    <div
      aria-live="polite"
      className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-sm"
      role="status"
    >
      <p>{feedback.message}</p>
      <p className="mt-1 font-medium">{feedback.detail}</p>
      {feedback.undo ? (
        <button
          className="mt-3 min-h-10 rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-900 outline-offset-2 transition hover:border-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800"
          type="button"
          onClick={onUndo}
        >
          Deshacer
        </button>
      ) : null}
    </div>
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
