"use client";

import { useEffect, useId, useRef, useState } from "react";

import { IntegrationPicker } from "@/components/integration-picker";
import {
  ResultPanel,
  type GenerationStatus,
} from "@/components/result-panel";
import { getIntegration, type IntegrationId } from "@/lib/integrations";
import { getTextDirection, type TextDirection } from "@/lib/text-direction";
import { MAX_PROMPT_LENGTH, MIN_PROMPT_LENGTH } from "@/lib/validation";

const EXAMPLE_IDEAS = [
  "A marketplace where creators sell digital products and get paid out weekly.",
  "An online course platform with cohorts, certificates and student progress reports.",
  "A subscription box for specialty coffee with a churn-recovery flow.",
];

export function BuilderComposer() {
  const [prompt, setPrompt] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<IntegrationId>>(
    new Set(),
  );
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [appliedIntegrations, setAppliedIntegrations] = useState<string[]>([]);
  // Direction of the prompt that produced the plan on screen — not of whatever
  // is in the textarea now, so an Arabic result stays RTL while the user types
  // the next prompt in English.
  const [resultDirection, setResultDirection] = useState<TextDirection>("ltr");

  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const validationId = useId();

  const isStreaming = status === "streaming";

  // Never leave a request running after the component goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  function toggleIntegration(id: IntegrationId) {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function generate() {
    // Guard against double submits from Enter-mashing or a fast double click.
    if (isStreaming) return;

    const trimmed = prompt.trim();
    if (trimmed.length < MIN_PROMPT_LENGTH) {
      setValidationError(
        trimmed.length === 0
          ? "Describe what you want to build first."
          : `Add a bit more detail — at least ${MIN_PROMPT_LENGTH} characters.`,
      );
      textareaRef.current?.focus();
      return;
    }

    const integrationIds = [...selected];
    const controller = new AbortController();
    abortRef.current = controller;

    setValidationError(null);
    setError(null);
    setContent("");
    setAppliedIntegrations(
      integrationIds.map((id) => getIntegration(id).name),
    );
    setResultDirection(getTextDirection(trimmed));
    setStatus("streaming");
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, integrationIds }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const message = await readErrorMessage(response);
        setError(message);
        setStatus("error");
        return;
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) setContent((current) => current + value);
      }

      setStatus("done");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") {
        // User pressed Stop: keep whatever streamed in, drop the busy state.
        setStatus("idle");
        return;
      }
      setError("Lost connection to the server. Check your network and retry.");
      setStatus("error");
    } finally {
      abortRef.current = null;
    }
  }

  const charactersLeft = MAX_PROMPT_LENGTH - prompt.length;

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void generate();
        }}
        className="rounded-2xl border border-line bg-surface p-5 sm:p-6"
      >
        <label
          htmlFor="idea"
          className="mb-2 block text-sm font-medium text-ink"
        >
          Your idea
        </label>

        <textarea
          id="idea"
          ref={textareaRef}
          value={prompt}
          // Native bidi handling: the browser flips to RTL as soon as the text
          // is Arabic, and back for English. No state, no re-render.
          dir="auto"
          maxLength={MAX_PROMPT_LENGTH}
          rows={5}
          disabled={isStreaming}
          aria-invalid={validationError !== null}
          aria-describedby={validationError ? validationId : undefined}
          placeholder="Build a marketplace where creators can sell digital products and receive payment notifications."
          onChange={(event) => {
            setPrompt(event.target.value);
            if (validationError) setValidationError(null);
          }}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void generate();
            }
          }}
          className="w-full resize-y rounded-xl border border-line bg-canvas px-4 py-3 text-[0.95rem] leading-relaxed text-ink placeholder:text-muted/60 focus:border-line-strong focus:outline-none disabled:opacity-60"
        />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p
            id={validationId}
            role={validationError ? "alert" : undefined}
            className={`text-xs ${validationError ? "text-red-300" : "text-muted"}`}
          >
            {validationError ?? "Press ⌘/Ctrl + Enter to generate."}
          </p>
          <p
            className={`text-xs tabular-nums ${
              charactersLeft < 100 ? "text-amber-300" : "text-muted"
            }`}
          >
            {charactersLeft} left
          </p>
        </div>

        {prompt.length === 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLE_IDEAS.map((example) => (
              <button
                key={example}
                type="button"
                disabled={isStreaming}
                onClick={() => {
                  setPrompt(example);
                  setValidationError(null);
                  textareaRef.current?.focus();
                }}
                className="rounded-full border border-line bg-canvas px-3 py-1.5 text-xs text-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
              >
                {example.split(" ").slice(0, 5).join(" ")}…
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 border-t border-line pt-5">
          <IntegrationPicker
            selected={selected}
            disabled={isStreaming}
            onToggle={toggleIntegration}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isStreaming}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isStreaming && <Spinner />}
            {isStreaming ? "Generating…" : "Generate build plan"}
          </button>

          {isStreaming && (
            <button
              type="button"
              onClick={stop}
              className="rounded-xl border border-line px-4 py-2.5 text-sm text-muted transition-colors hover:border-line-strong hover:text-ink"
            >
              Stop
            </button>
          )}

          <p className="text-xs text-muted">
            {selected.size === 0
              ? "No tools selected"
              : `${selected.size} tool${selected.size === 1 ? "" : "s"} selected`}
          </p>
        </div>
      </form>

      <div ref={resultRef} className="scroll-mt-6">
        <ResultPanel
          status={status}
          content={content}
          error={error}
          appliedIntegrations={appliedIntegrations}
          direction={resultDirection}
        />
      </div>
    </div>
  );
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.error === "string") return body.error;
  } catch {
    // Fall through to the generic message below.
  }
  return `The server responded with ${response.status}. Try again.`;
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="h-3.5 w-3.5 animate-spin"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.3"
      />
      <path
        d="M14 8a6 6 0 0 0-6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
