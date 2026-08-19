import { BuilderComposer } from "@/components/builder-composer";

export default function Home() {
  return (
    <main className="relative z-10 mx-auto w-full max-w-3xl px-5 pb-24 pt-16 sm:pt-24">
      <header className="mb-10 sm:mb-12">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-bright" />
          AI build planner
        </p>

        <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          What do you want to build?
        </h1>

        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          Describe your idea, choose the tools you want to work with, and let AI
          turn it into a practical build plan.
        </p>
      </header>

      <BuilderComposer />

      <footer className="mt-12 border-t border-line pt-6 text-xs text-muted">
        Integrations are context only — nothing is connected and no OAuth runs.
        Selecting them changes the system prompt sent to the model.
      </footer>
    </main>
  );
}
