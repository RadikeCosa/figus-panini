import { CollectionDashboard } from "./_components/collection-dashboard";
import { MainNavigation } from "./_components/main-navigation";

export default function Home() {
  return (
    <main className="min-h-dvh bg-zinc-50 px-4 py-5 text-zinc-950">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <header className="rounded-lg bg-emerald-900 px-5 py-6 text-white shadow-sm">
          <p className="text-sm font-medium text-emerald-100">Figuritas</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Álbum de Pedro
          </h1>
          <p className="mt-3 text-sm leading-6 text-emerald-50">
            Estado real de la colección guardada en este navegador.
          </p>
        </header>

        <CollectionDashboard />

        <section aria-labelledby="navigation-title" className="space-y-3">
          <h2 id="navigation-title" className="text-base font-semibold">
            Próximas acciones
          </h2>
          <MainNavigation />
        </section>
      </div>
    </main>
  );
}
