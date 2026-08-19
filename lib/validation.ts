import { isIntegrationId, type IntegrationId } from "@/lib/integrations";

export const MIN_PROMPT_LENGTH = 10;
export const MAX_PROMPT_LENGTH = 2000;

export type GenerateRequest = {
  prompt: string;
  integrationIds: IntegrationId[];
};

type ParseResult =
  | { ok: true; value: GenerateRequest }
  | { ok: false; error: string };

/**
 * Validates an untrusted request body. Kept as a plain function rather than a
 * schema library: there is one small schema, and hand-written checks let us
 * return a message the UI can show verbatim.
 */
export function parseGenerateRequest(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Expected a JSON object." };
  }

  const { prompt, integrationIds } = body as Record<string, unknown>;

  if (typeof prompt !== "string") {
    return { ok: false, error: "`prompt` must be a string." };
  }

  const trimmedPrompt = prompt.trim();

  if (trimmedPrompt.length < MIN_PROMPT_LENGTH) {
    return {
      ok: false,
      error: `Describe your idea in at least ${MIN_PROMPT_LENGTH} characters.`,
    };
  }

  if (trimmedPrompt.length > MAX_PROMPT_LENGTH) {
    return {
      ok: false,
      error: `Keep your idea under ${MAX_PROMPT_LENGTH} characters.`,
    };
  }

  if (integrationIds !== undefined && !Array.isArray(integrationIds)) {
    return { ok: false, error: "`integrationIds` must be an array." };
  }

  const rawIds: unknown[] = integrationIds ?? [];
  const seen = new Set<IntegrationId>();

  for (const id of rawIds) {
    if (!isIntegrationId(id)) {
      return { ok: false, error: `Unsupported integration: ${String(id)}` };
    }
    seen.add(id);
  }

  return {
    ok: true,
    value: { prompt: trimmedPrompt, integrationIds: [...seen] },
  };
}
