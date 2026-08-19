"use client";

import { useEffect, useState } from "react";

import { Markdown } from "@/components/markdown";
import type { TextDirection } from "@/lib/text-direction";

export type GenerationStatus = "idle" | "streaming" | "done" | "error";

type Props = {
  status: GenerationStatus;
  content: string;
  error: string | null;
  /** Names of the integrations that shaped the plan currently on screen. */
  appliedIntegrations: string[];
  /** Reading direction of the prompt that produced the plan on screen. */
  direction: TextDirection;
};

export function ResultPanel({
  status,
  content,
  error,
  appliedIntegrations,
  direction,
}: Props) {
  const isStreaming = status === "streaming";
  const hasContent = content.length > 0;

  return (
    <section
      aria-label="Generated build plan"
      aria-busy={isStreaming}
      className="rounded-2xl border border-line bg-surface"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="flex items-center gap-2">
          <StatusDot status={status} />
          <p className="text-sm font-medium text-ink" aria-live="polite">
            {headerLabel(status)}
          </p>
        </div>

        {hasContent && !isStreaming && <CopyButton value={content} />}
      </header>

      <div className="px-5 py-5 sm:px-6">
        {status === "error" && <ErrorState message={error} />}

        {status === "idle" && !hasContent && <EmptyState />}

        {hasContent && (
          <>
            {appliedIntegrations.length > 0 && (
              <p className="mb-5 text-xs text-muted">
                Written with{" "}
                <span className="text-ink">
                  {appliedIntegrations.join(", ")}
                </span>{" "}
                in the system prompt.
              </p>
            )}
            {/* Only the model's own output flips direction — the panel
                header and the integration line stay LTR app chrome. */}
            <div dir={direction}>
              <Markdown content={content} />
              {isStreaming && (
                <span
                  aria-hidden="true"
                  className="ms-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-accent-bright"
                />
              )}
            </div>
          </>
        )}

        {isStreaming && !hasContent && <ThinkingState />}
      </div>
    </section>
  );
}

function headerLabel(status: GenerationStatus): string {
  switch (status) {
    case "streaming":
      return "Generating build plan…";
    case "done":
      return "Build plan ready";
    case "error":
      return "Generation failed";
    case "idle":
      return "Build plan";
  }
}

function StatusDot({ status }: { status: GenerationStatus }) {
  const color =
    status === "error"
      ? "bg-red-400"
      : status === "done"
        ? "bg-emerald-400"
        : status === "streaming"
          ? "bg-accent-bright animate-pulse"
          : "bg-line-strong";

  return (
    <span aria-hidden="true" className={`h-2 w-2 rounded-full ${color}`} />
  );
}

function EmptyState() {
  return (
    <div className="py-8 text-center">
      <p className="text-sm text-ink">Nothing generated yet.</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
        Describe an idea, pick the tools you want to work with, and the plan
        will stream in here.
      </p>
    </div>
  );
}

function ThinkingState() {
  return (
    <div className="space-y-3 py-2" aria-hidden="true">
      {["w-2/5", "w-full", "w-11/12", "w-3/4"].map((width, index) => (
        <div
          key={index}
          className={`h-3 animate-pulse rounded bg-elevated ${width}`}
          style={{ animationDelay: `${index * 120}ms` }}
        />
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string | null }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3"
    >
      <p className="text-sm font-medium text-red-300">
        {message ?? "Something went wrong."}
      </p>
      <p className="mt-1 text-xs text-muted">
        Nothing was saved. Adjust your idea or try again.
      </p>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
      className="rounded-md border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-line-strong hover:text-ink"
    >
      {copied ? "Copied" : "Copy Markdown"}
    </button>
  );
}
