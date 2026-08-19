"use client";

import { IntegrationIcon } from "@/components/integration-icon";
import type { Integration } from "@/lib/integrations";

type Props = {
  integration: Integration;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
};

export function IntegrationCard({
  integration,
  selected,
  disabled,
  onToggle,
}: Props) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
      className={`group flex items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? "border-accent bg-accent-soft"
          : "border-line bg-surface hover:border-line-strong hover:bg-elevated"
      }`}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas transition-colors"
        style={{ color: selected ? integration.accent : undefined }}
      >
        <IntegrationIcon id={integration.id} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">
          {integration.name}
        </span>
        <span className="block truncate text-xs text-muted">
          {integration.tagline}
        </span>
      </span>

      <span
        aria-hidden="true"
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
          selected
            ? "border-accent bg-accent text-white"
            : "border-line-strong text-transparent"
        }`}
      >
        <svg
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-2.5 w-2.5"
        >
          <path d="m2.5 6.5 2.5 2.5 4.5-5" />
        </svg>
      </span>
    </button>
  );
}
