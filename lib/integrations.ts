/**
 * The single source of truth for supported integrations.
 *
 * Everything else — the UI selector, server-side validation, and the system
 * prompt — reads from this file, so adding an integration is a one-line change.
 */

export const INTEGRATION_IDS = [
  "stripe",
  "shopify",
  "gmail",
  "slack",
  "google-sheets",
] as const;

export type IntegrationId = (typeof INTEGRATION_IDS)[number];

export type Integration = {
  id: IntegrationId;
  name: string;
  /** Short label shown under the name in the selector. */
  tagline: string;
  /**
   * What the model is told this service is good for. This is the text that
   * actually reaches the system prompt, so it is written for the model rather
   * than for the user.
   */
  capability: string;
  /** Brand-adjacent accent, used for the icon tint only. */
  accent: string;
};

export const INTEGRATIONS: readonly Integration[] = [
  {
    id: "stripe",
    name: "Stripe",
    tagline: "Payments & billing",
    capability:
      "payments, checkout sessions, subscriptions, invoicing, payouts, and payment lifecycle webhooks such as checkout.session.completed and invoice.payment_failed",
    accent: "#635BFF",
  },
  {
    id: "shopify",
    name: "Shopify",
    tagline: "Commerce & catalog",
    capability:
      "product catalog, inventory, orders and fulfilment, storefront APIs, and commerce webhooks such as orders/create and inventory_levels/update",
    accent: "#95BF47",
  },
  {
    id: "gmail",
    name: "Gmail",
    tagline: "Email delivery & inbox",
    capability:
      "sending transactional and lifecycle email from a user's own mailbox, reading and labelling threads, and watching the inbox for replies",
    accent: "#EA4335",
  },
  {
    id: "slack",
    name: "Slack",
    tagline: "Team notifications",
    capability:
      "channel notifications, alerting, approval flows via interactive messages, and internal bot commands",
    accent: "#5B4EE5",
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    tagline: "Reporting & ops data",
    capability:
      "lightweight reporting, exports, back-office data entry, and spreadsheets used as an operational source of truth by non-technical teams",
    accent: "#0F9D58",
  },
];

const INTEGRATIONS_BY_ID = new Map<IntegrationId, Integration>(
  INTEGRATIONS.map((integration) => [integration.id, integration]),
);

export function isIntegrationId(value: unknown): value is IntegrationId {
  return (
    typeof value === "string" &&
    INTEGRATIONS_BY_ID.has(value as IntegrationId)
  );
}

export function getIntegration(id: IntegrationId): Integration {
  const integration = INTEGRATIONS_BY_ID.get(id);
  if (!integration) {
    throw new Error(`Unknown integration: ${id}`);
  }
  return integration;
}
