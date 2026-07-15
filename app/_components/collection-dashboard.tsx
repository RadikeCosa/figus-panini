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
  getCanonicalSectionSuggestions,
  getDuplicateCopyCount,
  getGlobalProgress,
  getUniqueOwnedCount,
  listMissingPositions,
  parsePositionQuery,
  type CollectionState,
  type PositionQueryResult,
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
      <QuickPositionLookup collection={collection} />

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

function QuickPositionLookup({ collection }: { collection: CollectionState }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<PositionQueryResult | null>(null);
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
  const showSuggestions = suggestionsOpen && hasSuggestions;
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
    setSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
    setResult(parsePositionQuery(value, collection));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runQuery(query);
  }

  function selectSuggestion(value: string) {
    setQuery(value);
    setResult(null);
    setSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);

    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(value.length, value.length);
    });
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && hasSuggestions) {
      event.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestionIndex((current) =>
        current < suggestions.length - 1 ? current + 1 : 0,
      );
      return;
    }

    if (event.key === "ArrowUp" && hasSuggestions) {
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
              setSuggestionsOpen(true);
              setActiveSuggestionIndex(-1);
            }}
            onFocus={() => {
              if (hasSuggestions) {
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
          type="submit"
        >
          Consultar
        </button>
      </form>

      <div
        aria-live="polite"
        className={result?.status === "found" ? "mt-3" : undefined}
        id={resultId}
      >
        {result?.status === "found" ? <LookupResult result={result} /> : null}
      </div>
    </section>
  );
}

function LookupResult({
  result,
}: {
  result: Extract<PositionQueryResult, { status: "found" }>;
}) {
  const title = `${result.position.section} ${result.position.position}`;

  if (result.ownership === "missing") {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
        <p className="text-lg font-bold text-amber-950">{title}</p>
        <p className="mt-1 text-sm font-semibold text-amber-900">No la tenés.</p>
        <p className="mt-1 text-sm text-amber-800">0 copias.</p>
      </div>
    );
  }

  if (result.ownership === "duplicate") {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-lg font-bold text-emerald-950">{title}</p>
        <p className="mt-1 text-sm font-semibold text-emerald-900">
          La tenés repetida.
        </p>
        <p className="mt-1 text-sm text-emerald-800">
          {result.copies} copias en total · {result.duplicateCopies} repetidas.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-lg font-bold text-emerald-950">{title}</p>
      <p className="mt-1 text-sm font-semibold text-emerald-900">La tenés.</p>
      <p className="mt-1 text-sm text-emerald-800">1 copia.</p>
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
