import Link from "next/link";

type PlaceholderPageProps = {
  title: string;
};

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <main className="min-h-dvh bg-zinc-50 px-4 py-6 text-zinc-950">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md flex-col justify-center">
        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-emerald-700">Pendiente</p>
          <h1 className="mt-2 text-2xl font-bold">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Esta funcionalidad todavía no está implementada.
          </p>
          <Link
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white outline-offset-2 transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-950"
            href="/"
          >
            Volver al inicio
          </Link>
        </section>
      </div>
    </main>
  );
}
