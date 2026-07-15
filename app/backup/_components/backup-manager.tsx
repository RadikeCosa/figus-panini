"use client";

import Link from "next/link";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildCollectionBackupFileName,
  buildCollectionBackupSummary,
  createCollectionBackup,
  parseCollectionBackupText,
  serializeCollectionBackup,
  type CollectionBackupSummary,
  type CollectionBackupValidationIssue,
  type ValidCollectionBackup,
} from "../../../domain/backup/collection-backup";
import type { CollectionState } from "../../../domain/collection/collection";
import type { CollectionRepository } from "../../../infrastructure/persistence/collection-repository";
import { createBrowserCollectionRepository } from "../../repositories/browser-collection-repository";

export const MAX_BACKUP_FILE_BYTES = 1024 * 1024;

type LoadState =
  | { status: "loading" }
  | { status: "ready"; collection: CollectionState }
  | { status: "error" };

type WorkState = "idle" | "exporting" | "reading" | "restoring";

type BackupManagerProps = {
  createRepository?: () => CollectionRepository;
  downloadTextFile?: (fileName: string, contents: string) => void;
  readFileText?: (file: File) => Promise<string>;
  now?: () => Date;
  maxFileBytes?: number;
};

type ImportState =
  | { status: "idle" }
  | { status: "valid"; value: ValidCollectionBackup }
  | { status: "invalid"; issues: CollectionBackupValidationIssue[] }
  | { status: "file-error"; message: string };

const CURRENT_SUMMARY_DATE = "1970-01-01T00:00:00.000Z";

export function BackupManager({
  createRepository = createBrowserCollectionRepository,
  downloadTextFile = downloadBrowserTextFile,
  readFileText = readBrowserFileText,
  now = () => new Date(),
  maxFileBytes = MAX_BACKUP_FILE_BYTES,
}: BackupManagerProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [workState, setWorkState] = useState<WorkState>("idle");
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [importState, setImportState] = useState<ImportState>({ status: "idle" });
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const repositoryRef = useRef<CollectionRepository | null>(null);
  const isBusy = workState !== "idle";

  const loadCollection = useCallback(async () => {
    try {
      const repository = createRepository();
      repositoryRef.current = repository;
      const collection = await repository.load();
      setLoadState({ status: "ready", collection });
    } catch {
      repositoryRef.current = null;
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
          setLoadState({ status: "ready", collection });
        }
      } catch {
        if (active) {
          repositoryRef.current = null;
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

  function handleExport() {
    if (loadState.status !== "ready" || isBusy) {
      return;
    }

    setWorkState("exporting");
    setExportMessage(null);
    setRestoreError(null);

    try {
      const exportedAt = now();
      const backup = createCollectionBackup(loadState.collection, exportedAt);
      const contents = serializeCollectionBackup(backup);
      const fileName = buildCollectionBackupFileName(exportedAt);
      downloadTextFile(fileName, contents);
      setExportMessage(`Respaldo generado: ${fileName}`);
    } finally {
      setWorkState("idle");
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setExportMessage(null);
    setRestoreMessage(null);
    setRestoreError(null);
    setImportState({ status: "idle" });

    if (!file || isBusy) {
      return;
    }

    const fileError = validateSelectedFile(file, maxFileBytes);

    if (fileError) {
      setImportState({ status: "file-error", message: fileError });
      return;
    }

    setWorkState("reading");

    try {
      const text = await readFileText(file);
      const result = parseCollectionBackupText(text);

      if (result.ok) {
        setImportState({ status: "valid", value: result.value });
      } else {
        setImportState({ status: "invalid", issues: result.issues });
      }
    } catch {
      setImportState({
        status: "file-error",
        message: "No fue posible leer el archivo.",
      });
    } finally {
      setWorkState("idle");
    }
  }

  async function handleRestore() {
    if (
      loadState.status !== "ready" ||
      importState.status !== "valid" ||
      isBusy ||
      !repositoryRef.current
    ) {
      return;
    }

    setWorkState("restoring");
    setRestoreError(null);
    setRestoreMessage(null);

    try {
      await repositoryRef.current.save(importState.value.collection);
      setLoadState({ status: "ready", collection: importState.value.collection });
      setImportState({ status: "idle" });
      setFileInputKey((current) => current + 1);
      setRestoreMessage("Colección restaurada correctamente.");
    } catch {
      setRestoreError("No fue posible restaurar. La colección actual no se modificó.");
    } finally {
      setWorkState("idle");
    }
  }

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
          <p className="mt-4 text-sm font-medium text-emerald-100">Respaldo</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Respaldo y restauración
          </h1>
          <p className="mt-3 text-sm leading-6 text-emerald-50">
            Exportá o reemplazá la colección guardada en este navegador.
          </p>
        </header>

        {loadState.status === "loading" ? <BackupLoading /> : null}
        {loadState.status === "error" ? (
          <BackupLoadError onRetry={retryLoadCollection} />
        ) : null}
        {loadState.status === "ready" ? (
          <section className="space-y-4">
            <CurrentCollectionSummary collection={loadState.collection} />

            <ExportSection
              disabled={isBusy}
              exportMessage={exportMessage}
              workState={workState}
              onExport={handleExport}
            />

            <RestoreSection
              currentCollection={loadState.collection}
              fileInputKey={fileInputKey}
              importState={importState}
              isBusy={isBusy}
              restoreError={restoreError}
              restoreMessage={restoreMessage}
              workState={workState}
              onFileChange={(event) => void handleFileChange(event)}
              onRestore={() => void handleRestore()}
            />
          </section>
        ) : null}
      </div>
    </main>
  );
}

function CurrentCollectionSummary({ collection }: { collection: CollectionState }) {
  const summary = useMemo(() => summarizeCurrentCollection(collection), [collection]);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-zinc-500">Colección actual</p>
      <SummaryList summary={summary} />
    </section>
  );
}

function ExportSection({
  disabled,
  exportMessage,
  workState,
  onExport,
}: {
  disabled: boolean;
  exportMessage: string | null;
  workState: WorkState;
  onExport: () => void;
}) {
  return (
    <section
      aria-labelledby="export-title"
      className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <h2 id="export-title" className="text-xl font-bold text-zinc-950">
        Exportar respaldo
      </h2>
      <p className="mt-2 text-sm text-zinc-600">
        Genera un archivo JSON con las cantidades guardadas.
      </p>
      <button
        className="mt-4 min-h-12 w-full rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white outline-offset-2 transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-400"
        disabled={disabled}
        type="button"
        onClick={onExport}
      >
        {workState === "exporting" ? "Generando..." : "Exportar respaldo"}
      </button>
      {exportMessage ? (
        <p className="mt-3 text-sm font-semibold text-emerald-700" role="status">
          {exportMessage}
        </p>
      ) : null}
    </section>
  );
}

function RestoreSection({
  currentCollection,
  fileInputKey,
  importState,
  isBusy,
  restoreError,
  restoreMessage,
  workState,
  onFileChange,
  onRestore,
}: {
  currentCollection: CollectionState;
  fileInputKey: number;
  importState: ImportState;
  isBusy: boolean;
  restoreError: string | null;
  restoreMessage: string | null;
  workState: WorkState;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRestore: () => void;
}) {
  const currentSummary = useMemo(
    () => summarizeCurrentCollection(currentCollection),
    [currentCollection],
  );

  return (
    <section
      aria-labelledby="restore-title"
      className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <h2 id="restore-title" className="text-xl font-bold text-zinc-950">
        Restaurar respaldo
      </h2>
      <p className="mt-2 text-sm text-zinc-600">
        El archivo se valida antes de reemplazar la colección actual.
      </p>

      <div className="mt-4 space-y-2">
        <label className="block text-sm font-semibold text-zinc-800" htmlFor="backup-file">
          Archivo JSON
        </label>
        <input
          accept=".json,application/json"
          className="block min-h-12 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-950 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white focus:outline focus:outline-2 focus:outline-emerald-700 disabled:bg-zinc-100"
          disabled={isBusy}
          id="backup-file"
          key={fileInputKey}
          type="file"
          onChange={onFileChange}
        />
      </div>

      {workState === "reading" ? (
        <p className="mt-3 text-sm font-semibold text-zinc-600" role="status">
          Validando archivo...
        </p>
      ) : null}

      {importState.status === "file-error" ? (
        <ErrorMessage message={importState.message} />
      ) : null}
      {importState.status === "invalid" ? (
        <ValidationIssues issues={importState.issues} />
      ) : null}
      {restoreError ? <ErrorMessage message={restoreError} /> : null}
      {restoreMessage ? (
        <div
          className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"
          role="status"
        >
          <p className="text-sm font-semibold">{restoreMessage}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <LinkButton href="/">Ir al inicio</LinkButton>
            <LinkButton href="/album">Ver álbum</LinkButton>
          </div>
        </div>
      ) : null}

      {importState.status === "valid" ? (
        <ValidatedBackupPreview
          currentSummary={currentSummary}
          disabled={isBusy}
          preview={importState.value}
          workState={workState}
          onRestore={onRestore}
        />
      ) : null}
    </section>
  );
}

function ValidatedBackupPreview({
  currentSummary,
  disabled,
  preview,
  workState,
  onRestore,
}: {
  currentSummary: CollectionBackupSummary;
  disabled: boolean;
  preview: ValidCollectionBackup;
  workState: WorkState;
  onRestore: () => void;
}) {
  return (
    <section className="mt-5 space-y-4" aria-labelledby="preview-title">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-semibold text-emerald-800">Archivo válido</p>
        <h3 id="preview-title" className="mt-1 text-lg font-bold text-emerald-950">
          Respaldo del {formatDateTime(preview.summary.exportedAt)}
        </h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <h4 className="text-base font-bold text-zinc-950">Colección actual</h4>
          <SummaryList summary={currentSummary} />
        </section>
        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <h4 className="text-base font-bold text-zinc-950">Respaldo</h4>
          <SummaryList summary={preview.summary} />
        </section>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
        <p className="text-sm font-semibold">
          La colección actual será reemplazada por completo.
        </p>
        <p className="mt-2 text-sm">
          El archivo ya fue validado. Esta acción no combina datos; conviene
          exportar un respaldo actual antes de continuar.
        </p>
        <button
          className="mt-4 min-h-12 w-full rounded-md bg-amber-900 px-4 py-2 text-sm font-semibold text-white outline-offset-2 transition hover:bg-amber-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-900 disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={disabled}
          type="button"
          onClick={onRestore}
        >
          {workState === "restoring"
            ? "Restaurando..."
            : "Reemplazar colección actual"}
        </button>
      </div>
    </section>
  );
}

function SummaryList({ summary }: { summary: CollectionBackupSummary }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-3">
      <SummaryItem label="Pegadas" value={summary.uniqueOwned} />
      <SummaryItem label="Faltantes" value={summary.missing} />
      <SummaryItem label="Repetidas" value={summary.duplicateCopies} />
      <SummaryItem label="Copias físicas" value={summary.physicalCopies} />
      <SummaryItem label="Posiciones repetidas" value={summary.duplicatePositions} />
    </dl>
  );
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <dt className="text-xs font-semibold uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 text-2xl font-bold text-zinc-950">{value}</dd>
    </div>
  );
}

function ValidationIssues({ issues }: { issues: CollectionBackupValidationIssue[] }) {
  return (
    <div
      className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-950"
      role="alert"
    >
      <p className="text-sm font-semibold">No se puede restaurar este archivo.</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {issues.map((issue, index) => (
          <li key={`${issue.code}-${index}`}>{issue.message}</li>
        ))}
      </ul>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <p
      className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800"
      role="alert"
    >
      {message}
    </p>
  );
}

function BackupLoading() {
  return (
    <section
      aria-live="polite"
      className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <p className="text-sm font-medium text-zinc-500">Cargando colección</p>
      <p className="mt-2 text-lg font-semibold text-zinc-950">
        Preparando respaldo...
      </p>
    </section>
  );
}

function BackupLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <section
      aria-live="assertive"
      className="rounded-lg border border-red-200 bg-red-50 p-5 shadow-sm"
      role="alert"
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

function LinkButton({ href, children }: { href: string; children: string }) {
  return (
    <Link
      className="inline-flex min-h-10 items-center justify-center rounded-md bg-emerald-900 px-3 py-2 text-sm font-semibold text-white outline-offset-2 transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-900"
      href={href}
    >
      {children}
    </Link>
  );
}

function summarizeCurrentCollection(collection: CollectionState): CollectionBackupSummary {
  return buildCollectionBackupSummary(collection, CURRENT_SUMMARY_DATE);
}

function validateSelectedFile(file: File, maxFileBytes: number): string | null {
  if (file.size === 0) {
    return "El archivo está vacío.";
  }

  if (file.size > maxFileBytes) {
    return "El archivo es demasiado grande.";
  }

  if (!file.name.toLocaleLowerCase("es").endsWith(".json")) {
    return "Seleccioná un archivo .json.";
  }

  if (
    file.type &&
    file.type !== "application/json" &&
    file.type !== "text/json"
  ) {
    return "El tipo de archivo no parece ser JSON.";
  }

  return null;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function readBrowserFileText(file: File): Promise<string> {
  return file.text();
}

function downloadBrowserTextFile(fileName: string, contents: string): void {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
