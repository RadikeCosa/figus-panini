"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  addCopy,
  getCanonicalSectionSuggestions,
  getDuplicateCopyCount,
  getGlobalProgress,
  getPositionCollectionStatus,
  getUniqueOwnedCount,
  listMissingPositions,
  parsePositionQuery,
  removeCopy,
  type CollectionState,
  type PositionQueryResult,
  type PositionRef,
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

type PersistCollectionChange = (
  operation: (collection: CollectionState) => CollectionState,
) => Promise<"saved" | "failed" | "blocked">;

type LastUndoAction = {
  position: PositionRef;
  operation: "add" | "remove";
};

export function CollectionDashboard({
  createRepository = createBrowserCollectionRepository,
}: CollectionDashboardProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
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
    } catch (error) {
      console.error("No fue posible cargar la colección.", error);
      collectionRef.current = null;
      setLoadState({ status: "error" });
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
        }
      } catch (error) {
        console.error("No fue posible cargar la colección.", error);

        if (active) {
          collectionRef.current = null;
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

  const persistCollectionChange = useCallback<PersistCollectionChange>(
    async (operation) => {
      const repository = repositoryRef.current;
      const previousCollection = collectionRef.current;

      if (savingRef.current) {
        return "blocked";
      }

      if (!repository || !previousCollection) {
        return "failed";
      }

      const nextCollection = operation(previousCollection);

      savingRef.current = true;
      collectionRef.current = nextCollection;
      setIsSaving(true);
      setLoadState({ status: "ready", collection: nextCollection });

      try {
        await repository.save(nextCollection);
        return "saved";
      } catch {
        collectionRef.current = previousCollection;
        setLoadState({ status: "ready", collection: previousCollection });
        return "failed";
      } finally {
        savingRef.current = false;
        setIsSaving(false);
      }
    },
    [],
  );

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

  return (
    <ReadySummary
      collection={loadState.collection}
      isSaving={isSaving}
      onPersistCollectionChange={persistCollectionChange}
    />
  );
}

function ReadySummary({
  collection,
  isSaving,
  onPersistCollectionChange,
}: {
  collection: CollectionState;
  isSaving: boolean;
  onPersistCollectionChange: PersistCollectionChange;
}) {
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
      <QuickPositionLookup
        collection={collection}
        isSaving={isSaving}
        onPersistCollectionChange={onPersistCollectionChange}
      />

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

function QuickPositionLookup({
  collection,
  isSaving,
  onPersistCollectionChange,
}: {
  collection: CollectionState;
  isSaving: boolean;
  onPersistCollectionChange: PersistCollectionChange;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<PositionQueryResult | null>(null);
  const [feedback, setFeedback] = useState<
    | { status: "success"; message: string }
    | { status: "error"; message: string }
    | null
  >(null);
  const [lastUndoAction, setLastUndoAction] = useState<LastUndoAction | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = useId();
  const resultId = useId();
  const suggestionsId = useId();
  const suggestions = useMemo(() => getCanonicalSectionSuggestions(query), [query]);
  const error = result ? getQueryErrorMessage(result) : null;
  const hasSuggestions = suggestions.length > 0;
  const showSuggestions = suggestionsOpen && hasSuggestions && !isSaving;
  const foundResult =
    result?.status === "found"
      ? getPositionCollectionStatus(collection, result.position)
      : null;
  const boundedActiveSuggestionIndex =
    activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length
      ? activeSuggestionIndex
      : -1;
  const activeSuggestion =
    showSuggestions && boundedActiveSuggestionIndex >= 0
      ? suggestions[boundedActiveSuggestionIndex]
      : null;
  const activeSuggestionId = activeSuggestion
    ? `${suggestionsId}-option-${boundedActiveSuggestionIndex}`
    : undefined;

  function runQuery(value: string) {
    if (isSaving) {
      return;
    }

    setSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
    setResult(parsePositionQuery(value, collection));
    setFeedback(null);
    setLastUndoAction(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runQuery(query);
  }

  function selectSuggestion(value: string) {
    setQuery(value);
    setResult(null);
    setFeedback(null);
    setLastUndoAction(null);
    setSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);

    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(value.length, value.length);
    });
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && hasSuggestions && !isSaving) {
      event.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestionIndex((current) =>
        current < suggestions.length - 1 ? current + 1 : 0,
      );
      return;
    }

    if (event.key === "ArrowUp" && hasSuggestions && !isSaving) {
      event.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestionIndex((current) =>
        current > 0 ? current - 1 : suggestions.length - 1,
      );
      return;
    }

    if (event.key === "Escape" && suggestionsOpen) {
      event.preventDefault();
      setSuggestionsOpen(false);
      setActiveSuggestionIndex(-1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      if (activeSuggestion) {
        selectSuggestion(activeSuggestion.value);
        return;
      }

      runQuery(event.currentTarget.value);
    }
  }

  async function handleAddCopy() {
    if (!foundResult || isSaving) {
      return;
    }

    const saveResult = await onPersistCollectionChange((currentCollection) =>
      addCopy(currentCollection, foundResult.position),
    );

    if (saveResult === "saved") {
      setFeedback({ status: "success", message: "Cambio guardado." });
      setLastUndoAction({ position: foundResult.position, operation: "remove" });
    } else if (saveResult === "failed") {
      setFeedback({
        status: "error",
        message: "No fue posible guardar el cambio. Reintentá la acción.",
      });
    }
  }

  async function handleGiveDuplicate() {
    if (!foundResult || foundResult.copies <= 1 || isSaving) {
      return;
    }

    const saveResult = await onPersistCollectionChange((currentCollection) =>
      removeCopy(currentCollection, foundResult.position),
    );

    if (saveResult === "saved") {
      setFeedback({ status: "success", message: "Cambio guardado." });
      setLastUndoAction({ position: foundResult.position, operation: "add" });
    } else if (saveResult === "failed") {
      setFeedback({
        status: "error",
        message: "No fue posible guardar el cambio. Reintentá la acción.",
      });
    }
  }

  async function handleUndo() {
    if (!lastUndoAction || isSaving) {
      return;
    }

    const saveResult = await onPersistCollectionChange((currentCollection) =>
      lastUndoAction.operation === "add"
        ? addCopy(currentCollection, lastUndoAction.position)
        : removeCopy(currentCollection, lastUndoAction.position),
    );

    if (saveResult === "saved") {
      setFeedback({ status: "success", message: "Cambio deshecho." });
      setLastUndoAction(null);
    } else if (saveResult === "failed") {
      setFeedback({
        status: "error",
        message: "No fue posible deshacer el cambio. Reintentá deshacer.",
      });
    }
  }

  return (
    <section
      aria-labelledby="quick-lookup-title"
      className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
    >
      <div>
        <p className="text-sm font-medium text-zinc-500">Consulta rápida</p>
        <h2 id="quick-lookup-title" className="mt-1 text-lg font-bold text-zinc-950">
          Buscá una figurita
        </h2>
      </div>

      <form className="mt-3 space-y-2" onSubmit={handleSubmit}>
        <div className="relative space-y-1.5">
          <label className="block text-sm font-semibold text-zinc-800" htmlFor={inputId}>
            Sección y número
          </label>
          <input
            aria-activedescendant={activeSuggestionId}
            aria-autocomplete="list"
            aria-controls={suggestionsId}
            aria-describedby={error ? errorId : undefined}
            aria-expanded={showSuggestions}
            aria-invalid={Boolean(error)}
            autoComplete="off"
            className="min-h-12 w-full rounded-md border border-zinc-300 bg-white px-3 text-base text-zinc-950 outline-offset-2 transition placeholder:text-zinc-400 focus:border-emerald-700 focus:outline focus:outline-2 focus:outline-emerald-700"
            disabled={isSaving}
            id={inputId}
            name="position-query"
            placeholder="Argentina 7"
            ref={inputRef}
            role="combobox"
            type="text"
            value={query}
            onBlur={() => {
              window.setTimeout(() => {
                setSuggestionsOpen(false);
                setActiveSuggestionIndex(-1);
              }, 100);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setResult(null);
              setFeedback(null);
              setLastUndoAction(null);
              setSuggestionsOpen(true);
              setActiveSuggestionIndex(-1);
            }}
            onFocus={() => {
              if (hasSuggestions && !isSaving) {
                setSuggestionsOpen(true);
              }
            }}
            onKeyDown={handleInputKeyDown}
          />
          {showSuggestions ? (
            <ul
              className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white p-1 shadow-lg"
              id={suggestionsId}
              role="listbox"
            >
              {suggestions.map((suggestion, index) => (
                <li
                  aria-selected={boundedActiveSuggestionIndex === index}
                  className="min-h-11 cursor-pointer rounded px-3 py-2 text-sm font-medium text-zinc-800 outline-none transition hover:bg-emerald-50 hover:text-emerald-950 aria-selected:bg-emerald-100 aria-selected:text-emerald-950"
                  id={`${suggestionsId}-option-${index}`}
                  key={suggestion.section}
                  role="option"
                  onClick={() => selectSuggestion(suggestion.value)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                >
                  {suggestion.section}
                </li>
              ))}
            </ul>
          ) : null}
          {error ? (
            <p className="text-sm font-medium text-red-700" id={errorId} role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <button
          className="min-h-11 w-full rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white outline-offset-2 transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-950"
          disabled={isSaving}
          type="submit"
        >
          Consultar
        </button>
      </form>

      <div
        aria-live="polite"
        className={foundResult ? "mt-3" : undefined}
        id={resultId}
      >
        {isSaving ? (
          <p className="mb-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            Guardando cambio...
          </p>
        ) : null}
        {foundResult ? (
          <LookupResult
            feedback={feedback}
            isSaving={isSaving}
            lastUndoAction={lastUndoAction}
            result={foundResult}
            onAddCopy={() => void handleAddCopy()}
            onGiveDuplicate={() => void handleGiveDuplicate()}
            onUndo={() => void handleUndo()}
          />
        ) : null}
      </div>
    </section>
  );
}

function LookupResult({
  feedback,
  isSaving,
  lastUndoAction,
  result,
  onAddCopy,
  onGiveDuplicate,
  onUndo,
}: {
  feedback:
    | { status: "success"; message: string }
    | { status: "error"; message: string }
    | null;
  isSaving: boolean;
  lastUndoAction: LastUndoAction | null;
  result: Extract<PositionQueryResult, { status: "found" }>;
  onAddCopy: () => void;
  onGiveDuplicate: () => void;
  onUndo: () => void;
}) {
  const title = `${result.position.section} ${result.position.position}`;
  const actionLabel =
    result.copies === 0 ? "Agregar figurita" : "Agregar otra copia";
  const actionAriaLabel = `${actionLabel} de ${title}`;
  const resultStyles =
    result.ownership === "missing"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : "border-emerald-200 bg-emerald-50 text-emerald-950";
  const stateText =
    result.ownership === "missing"
      ? "No la tenés."
      : result.ownership === "duplicate"
        ? "La tenés repetida."
        : "La tenés.";
  const quantityText =
    result.ownership === "duplicate"
      ? `${result.copies} copias en total · ${result.duplicateCopies} repetida${
          result.duplicateCopies === 1 ? "" : "s"
        }.`
      : `${result.copies} copia${result.copies === 1 ? "" : "s"}.`;

  return (
    <div className={`rounded-md border p-4 ${resultStyles}`}>
      <div>
        <p className="text-lg font-bold">{title}</p>
        <p className="mt-1 text-sm font-semibold">{stateText}</p>
        <p className="mt-1 text-sm">{quantityText}</p>
      </div>

      <div className="mt-3 grid gap-2">
        <button
          aria-label={actionAriaLabel}
          className="min-h-11 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white outline-offset-2 transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={isSaving}
          type="button"
          onClick={onAddCopy}
        >
          {actionLabel}
        </button>
        {result.copies > 1 ? (
          <button
            aria-label={`Entregué una copia de ${title}`}
            className="min-h-11 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-950 outline-offset-2 transition hover:border-emerald-700 hover:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            type="button"
            onClick={onGiveDuplicate}
          >
            Entregué una
          </button>
        ) : null}
      </div>

      {feedback ? (
        <div
          aria-live={feedback.status === "error" ? "assertive" : "polite"}
          className={`mt-3 rounded-md border px-3 py-2 text-sm font-semibold ${
            feedback.status === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-white text-emerald-900"
          }`}
          role={feedback.status === "error" ? "alert" : "status"}
        >
          <p>{feedback.message}</p>
          {lastUndoAction ? (
            <button
              className="mt-2 min-h-10 rounded-md border border-emerald-700 bg-white px-3 py-2 text-sm font-semibold text-emerald-900 outline-offset-2 transition hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving}
              type="button"
              onClick={onUndo}
            >
              Deshacer
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function getQueryErrorMessage(result: PositionQueryResult): string | null {
  switch (result.status) {
    case "empty-query":
      return "Ingresá una sección y un número.";
    case "missing-position-number":
      return "Agregá el número de la figurita.";
    case "section-not-found":
      return "Esa sección no existe en este álbum.";
    case "section-ambiguous":
      return "Esa sección es ambigua. Escribí el nombre completo.";
    case "non-numeric-position":
      return "El número de figurita debe ser numérico.";
    case "position-out-of-range":
      if (result.section === "PANINI") {
        return "PANINI solo tiene la posición 00.";
      }

      if (result.section === "FWC") {
        return "FWC tiene posiciones del 1 al 19.";
      }

      return `${result.section} tiene posiciones del 1 al 20.`;
    case "found":
      return null;
  }
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <dt className="text-sm font-medium text-zinc-500">{label}</dt>
      <dd className="mt-2 text-2xl font-bold text-zinc-950">{value}</dd>
    </div>
  );
}
