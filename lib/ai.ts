/**
 * The AI provider boundary. Everything above this file deals in
 * "system prompt in, text chunks out" and knows nothing about OpenRouter,
 * so swapping the model or the provider does not touch the UI or the route.
 *
 * OpenRouter exposes an OpenAI-compatible chat-completions endpoint, so this
 * is a plain fetch against a documented wire format rather than an SDK.
 */

const BASE_URL = "https://openrouter.ai/api/v1";

export const DEFAULT_MODEL = "openrouter/free";

/** Thrown when the server is missing the credentials it needs to call the model. */
export class AiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigurationError";
  }
}

/** Thrown when the provider was reachable but the request failed. */
export class AiRequestError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiRequestError";
  }
}

function requireApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new AiConfigurationError(
      "The server is missing OPENROUTER_API_KEY. Add it to .env.local and restart.",
    );
  }

  return apiKey;
}

export type BuildPlanInput = {
  systemPrompt: string;
  userPrompt: string;
  signal?: AbortSignal;
};

/**
 * Streams the model's answer as plain text chunks.
 *
 * Streaming is what makes a multi-second generation feel responsive, and it
 * also keeps us well clear of serverless response timeouts.
 */
export async function* streamBuildPlan(
  input: BuildPlanInput,
): AsyncGenerator<string> {
  const apiKey = requireApiKey();

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Optional OpenRouter attribution — names this app in the account's
        // activity log. Carries no credentials.
        "X-Title": "Build Planner",
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || DEFAULT_MODEL,
        stream: true,
        max_tokens: 4000,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt },
        ],
      }),
      signal: input.signal,
    });
  } catch (cause) {
    // A client hang-up surfaces here as an AbortError; the route treats that
    // as a cancellation rather than a provider failure.
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw cause;
    }
    throw new AiRequestError("Could not reach OpenRouter.", { cause });
  }

  if (!response.ok || !response.body) {
    throw new AiRequestError(await describeFailure(response), {
      cause: response.status,
    });
  }

  yield* readTextDeltas(response.body);
}

/** One server-sent frame from the chat-completions stream. */
type StreamFrame = {
  choices?: { delta?: { content?: string | null } }[];
  error?: { message?: string };
};

/**
 * Pulls assistant text out of the SSE stream.
 *
 * Frames are newline-delimited `data:` lines terminated by `[DONE]`. Reasoning
 * models also emit `delta.reasoning`, which is deliberately ignored — the
 * product wants the plan, not the model's scratchpad.
 */
async function* readTextDeltas(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  // `stream: true` holds back partial multi-byte sequences, so an Arabic
  // character split across two network chunks still decodes correctly.
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;

      buffer += decoder.decode(value, { stream: true });

      // Keep the trailing fragment: the last line may be a partial frame.
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();

        // Blank lines separate events; `:` lines are keep-alive comments.
        if (trimmed === "" || trimmed.startsWith(":")) continue;
        if (!trimmed.startsWith("data:")) continue;

        const payload = trimmed.slice("data:".length).trim();
        if (payload === "[DONE]") return;

        const frame = parseFrame(payload);
        if (frame?.error?.message) {
          throw new AiRequestError(
            `OpenRouter stopped mid-response: ${frame.error.message}`,
          );
        }

        const text = frame?.choices?.[0]?.delta?.content;
        if (text) yield text;
      }
    }
  } finally {
    // Releases the upstream connection on early return (the Stop button) as
    // well as on normal completion.
    await reader.cancel().catch(() => {});
  }
}

function parseFrame(payload: string): StreamFrame | null {
  try {
    return JSON.parse(payload) as StreamFrame;
  } catch {
    // A frame we cannot parse is not worth failing an otherwise good stream.
    return null;
  }
}

/** Builds a user-safe message from a failed response. Never echoes the key. */
async function describeFailure(response: Response): Promise<string> {
  if (response.status === 401) {
    return "OpenRouter rejected the API key. Check OPENROUTER_API_KEY in .env.local.";
  }

  let detail = "";
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    detail = body.error?.message ?? "";
  } catch {
    // Non-JSON error body; the status alone will have to do.
  }

  return detail
    ? `OpenRouter rejected the request (${response.status}): ${detail}`
    : `OpenRouter rejected the request (${response.status}).`;
}
