import Anthropic from "@anthropic-ai/sdk";

/**
 * The AI provider boundary. Everything above this file deals in
 * "system prompt in, text chunks out" and knows nothing about Anthropic,
 * so swapping the model or the provider does not touch the UI or the route.
 */

export const DEFAULT_MODEL = "claude-opus-5";

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

function createClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new AiConfigurationError(
      "The server is missing ANTHROPIC_API_KEY. Add it to .env.local and restart.",
    );
  }

  return new Anthropic({ apiKey });
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
  const client = createClient();

  const stream = client.messages.stream(
    {
      model: process.env.AI_MODEL || DEFAULT_MODEL,
      max_tokens: 4000,
      // Low effort keeps thinking shallow: this is a structured writing task,
      // not a hard reasoning one, and time-to-first-token drives how the
      // product feels.
      output_config: { effort: "low" },
      system: input.systemPrompt,
      messages: [{ role: "user", content: input.userPrompt }],
    },
    { signal: input.signal },
  );

  try {
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      throw new AiRequestError(
        `The AI provider rejected the request (${error.status}).`,
        { cause: error },
      );
    }
    throw error;
  }
}
