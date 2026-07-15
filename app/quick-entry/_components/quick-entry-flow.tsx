"use client";

import Link from "next/link";
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  addCopy,
  getCanonicalSectionSuggestions,
  getCopies,
  parsePositionQuery,
  removeCopy,
  type CollectionState,
  type PositionQueryResult,
  type PositionRef,
} from "../../../domain/collection/collection";
import type { CollectionRepository } from "../../../infrastructure/persistence/collection-repository";
import { createBrowserCollectionRepository } from "../../repositories/browser-collection-repository";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; collection: CollectionState }
  | { status: "error" };

type SaveState = "idle" | "saving" | "saved" | "error";

type LastAddition = {
  position: PositionRef;
};

type QuickEntryFlowProps = {
  createRepository?: () => CollectionRepository;
};

export function QuickEntryFlow({
  createRepository = createBrowserCollectionRepository,
}: QuickEntryFlowProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState<PositionQueryResult | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [lastAddition, setLastAddition] = useState<LastAddition | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const repositoryRef = useRef<CollectionRepository | null>(null);
  const collectionRef = useRef<CollectionState | null>(null);
  const savingRef = useRef(false);
  const inputId = "quick-entry-query";
  const suggestionsId = "quick-entry-suggestions";
  const errorId = "quick-entry-error";

  const loadCollection = useCallback(async () => {
    try {
      const repository = createRepository();
      repositoryRef.current = repository;
      const collection = await repository.load();
      collectionRef.current = collection;
      setLoadState({ status: "ready", collection });
      setSaveState("idle");
      requestAnimationFrame(() => inputRef.current?.focus());
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
          requestAnimationFrame(() => inputRef.current?.focus());
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

  useEffect(() => {
    if (loadState.status === "ready" && confirmation) {
      inputRef.current?.focus();
    }
  }, [confirmation, loadState.status]);

  const suggestions = useMemo(() => getCanonicalSectionSuggestions(query), [query]);
  const hasSuggestions = suggestions.length > 0;
  const showSuggestions = suggestionsOpen && hasSuggestions && !isSaving;
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
  const queryError = queryResult ? getQueryErrorMessage(queryResult) : null;
  const validResult = queryResult?.status === "found" ? queryResult : null;

  function resetForNextEntry(message: string, position: PositionRef) {
    setQuery("");
    setQueryResult(null);
    setSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
    setConfirmation(message);
    setLastAddition({ position });
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function persistChange(
    nextCollection: CollectionState,
    previousCollection: CollectionState,
  ): Promise<boolean> {
    const repository = repositoryRef.current;

    if (!repository) {
      return false;
    }

    savingRef.current = true;
    setIsSaving(true);
    collectionRef.current = nextCollection;
    setLoadState({ status: "ready", collection: nextCollection });
    setSaveState("saving");

    try {
      await repository.save(nextCollection);
      setSaveState("saved");
      return true;
    } catch {
      collectionRef.current = previousCollection;
      setLoadState({ status: "ready", collection: previousCollection });
      setSaveState("error");
      return false;
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (savingRef.current || loadState.status !== "ready") {
      return;
    }

    setSuggestionsOpen(false);
    setQueryResult(parsePositionQuery(query, loadState.collection));
    setConfirmation(null);
  }

  async function handleAddCopy() {
    if (!validResult || savingRef.current) {
      return;
    }

    const previousCollection = collectionRef.current;

    if (!previousCollection) {
      return;
    }

    const nextCollection = addCopy(previousCollection, validResult.position);
    const nextCopies = getCopies(nextCollection, validResult.position);
    const message = buildAddedMessage(validResult.position, nextCopies);
    const saved = await persistChange(nextCollection, previousCollection);

    if (saved) {
      resetForNextEntry(message, validResult.position);
    } else {
      setConfirmation(null);
    }
  }

  async function handleUndo() {
    if (!lastAddition || savingRef.current) {
      return;
    }

    const previousCollection = collectionRef.current;

    if (!previousCollection) {
      return;
    }

    const nextCollection = removeCopy(previousCollection, lastAddition.position);
    const nextCopies = getCopies(nextCollection, lastAddition.position);
    const saved = await persistChange(nextCollection, previousCollection);

    if (saved) {
      setLastAddition(null);
      setConfirmation(buildUndoMessage(lastAddition.position, nextCopies));
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function selectSuggestion(value: string) {
    setQuery(value);
    setQueryResult(null);
    setConfirmation(null);
    setSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
    requestAnimationFrame(() => {
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

    if (event.key === "Enter" && activeSuggestion) {
      event.preventDefault();
      selectSuggestion(activeSuggestion.value);
    }
  }

  return (
    <main className="min-h-dvh bg-zinc-50 px-4 py-5 text-zinc-950">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <header className="rounded-lg bg-emerald-900 px-5 py-6 text-white shadow-sm">
          <Link
            className="inline-flex min-h-10 items-center rounded-md px-1 text-sm font-semibold text-emerald-50 underline-offset-4 outline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            href="/"
          >
            Volver al inicio
          </Link>
          <p className="mt-4 text-sm font-medium text-emerald-100">Carga rápida</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Agregar figuritas
          </h1>
          <p className="mt-3 text-sm leading-6 text-emerald-50">
            Registrá una figurita y seguí con la próxima.
          </p>
        </header>

        {loadState.status === "loading" ? <QuickEntryLoading /> : null}
        {loadState.status === "error" ? (
          <QuickEntryLoadError onRetry={() => void loadCollection()} />
        ) : null}
        {loadState.status === "ready" ? (
          <section aria-labelledby="quick-entry-title" className="space-y-4">
            <form
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
              onSubmit={handleSubmit}
            >
              <h2 id="quick-entry-title" className="text-xl font-bold text-zinc-950">
                Buscar posición
              </h2>
              <div className="relative mt-4 space-y-2">
                <label
                  className="block text-sm font-semibold text-zinc-800"
                  htmlFor={inputId}
                >
                  Sección y número
                </label>
                <input
                  aria-activedescendant={activeSuggestionId}
                  aria-autocomplete="list"
                  aria-controls={suggestionsId}
                  aria-describedby={queryError ? errorId : undefined}
                  aria-expanded={showSuggestions}
                  aria-invalid={Boolean(queryError)}
                  autoComplete="off"
                  className="min-h-12 w-full rounded-md border border-zinc-300 bg-white px-3 text-base text-zinc-950 outline-offset-2 transition placeholder:text-zinc-400 focus:border-emerald-700 focus:outline focus:outline-2 focus:outline-emerald-700 disabled:bg-zinc-100"
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
                    setQueryResult(null);
                    setConfirmation(null);
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
                        onMouseDown={(event) => event.preventDefault()}
                      >
                        {suggestion.section}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {queryError ? (
                  <p className="text-sm font-medium text-red-700" id={errorId} role="alert">
                    {queryError}
                  </p>
                ) : null}
              </div>

              <button
                className="mt-4 min-h-12 w-full rounded-md bg-zinc-950 px-4 py-2 text-base font-semibold text-white outline-offset-2 transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-400"
                disabled={isSaving}
                type="submit"
              >
                Consultar
              </button>
            </form>

            <SaveStatus state={saveState} />

            {validResult ? (
              <PositionPreview
                isSaving={isSaving}
                result={validResult}
                onAddCopy={() => void handleAddCopy()}
              />
            ) : null}

            {confirmation ? (
              <section
                aria-live="polite"
                className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 shadow-sm"
              >
                <p className="text-sm font-semibold whitespace-pre-line">
                  {confirmation}
                </p>
                {lastAddition ? (
                  <button
                    className="mt-3 min-h-11 rounded-md border border-emerald-700 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 outline-offset-2 transition hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSaving}
                    type="button"
                    onClick={() => void handleUndo()}
                  >
                    Deshacer
                  </button>
                ) : null}
              </section>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function QuickEntryLoading() {
  return (
    <section
      aria-live="polite"
      className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <p className="text-sm font-medium text-zinc-500">Cargando colección</p>
      <p className="mt-2 text-lg font-semibold text-zinc-950">
        Preparando la carga rápida...
      </p>
    </section>
  );
}

function QuickEntryLoadError({ onRetry }: { onRetry: () => void }) {
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
        onClick={onRetry}
      >
        Reintentar
      </button>
    </section>
  );
}

function SaveStatus({ state }: { state: SaveState }) {
  if (state === "idle") {
    return null;
  }

  const message =
    state === "saving"
      ? "Guardando..."
      : state === "saved"
        ? "Guardado."
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

function PositionPreview({
  isSaving,
  result,
  onAddCopy,
}: {
  isSaving: boolean;
  result: Extract<PositionQueryResult, { status: "found" }>;
  onAddCopy: () => void;
}) {
  const title = `${result.position.section} ${result.position.position}`;
  const state =
    result.ownership === "missing"
      ? "Faltante"
      : result.ownership === "duplicate"
        ? "Repetida"
        : "Pegada";
  const quantity =
    result.copies === 0
      ? "0 copias"
      : result.copies === 1
        ? "1 copia"
        : `${result.copies} copias · ${result.duplicateCopies} repetidas`;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-emerald-700">{state}</p>
      <h2 className="mt-2 text-2xl font-bold text-zinc-950">{title}</h2>
      <p className="mt-2 text-sm font-semibold text-zinc-700">{quantity}</p>
      <button
        className="mt-5 min-h-12 w-full rounded-md bg-emerald-700 px-4 py-2 text-base font-semibold text-white outline-offset-2 transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
        disabled={isSaving}
        type="button"
        onClick={onAddCopy}
      >
        Agregar copia
      </button>
    </section>
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

function buildAddedMessage(position: PositionRef, copies: number): string {
  return `${position.section} ${position.position} agregada.\n${formatCurrentCopies(copies)}`;
}

function buildUndoMessage(position: PositionRef, copies: number): string {
  return `Se deshizo ${position.section} ${position.position}.\n${formatCurrentCopies(copies)}`;
}

function formatCurrentCopies(copies: number): string {
  if (copies === 0) {
    return "Ahora no la tenés.";
  }

  if (copies === 1) {
    return "Ahora tenés 1 copia.";
  }

  return `Ahora tenés ${copies} copias · ${copies - 1} repetidas.`;
}
