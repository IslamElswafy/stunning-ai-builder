import type { ReactNode } from "react";

import type { IntegrationId } from "@/lib/integrations";

/**
 * Generic category glyphs rather than brand logos: the integrations here are
 * context only, so shipping real trademarks would overstate what the app does.
 */
const GLYPHS: Record<IntegrationId, ReactNode> = {
  stripe: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19" />
    </>
  ),
  shopify: (
    <>
      <path d="M4 8h16l-1.2 11a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  gmail: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  slack: (
    <>
      <path d="M9.5 3v10.5a2.5 2.5 0 1 1-2.5-2.5h10.5" />
      <path d="M14.5 21V10.5A2.5 2.5 0 1 1 17 13H6.5" />
    </>
  ),
  "google-sheets": (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <path d="M3.5 9.5h17M3.5 15h17M9.5 4v16" />
    </>
  ),
};

export function IntegrationIcon({ id }: { id: IntegrationId }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4"
    >
      {GLYPHS[id]}
    </svg>
  );
}
