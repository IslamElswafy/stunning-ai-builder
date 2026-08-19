import {
  AiConfigurationError,
  AiRequestError,
  streamBuildPlan,
} from "@/lib/ai";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompt";
import { parseGenerateRequest } from "@/lib/validation";

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/**
 * Turns an unknown failure into a response that is safe to show a user.
 * Details are logged server-side; stack traces never cross the wire.
 */
function aiErrorResponse(error: unknown): Response {
  console.error("[api/generate]", error);

  if (error instanceof AiConfigurationError) {
    return errorResponse(error.message, 503);
  }
  if (error instanceof AiRequestError) {
    return errorResponse(error.message, 502);
  }
  return errorResponse("Could not reach the AI provider. Try again.", 502);
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  const parsed = parseGenerateRequest(body);
  if (!parsed.ok) {
    return errorResponse(parsed.error, 400);
  }

  const { prompt, integrationIds } = parsed.value;

  const chunks = streamBuildPlan({
    systemPrompt: buildSystemPrompt(integrationIds),
    userPrompt: buildUserPrompt(prompt),
    signal: request.signal,
  })[Symbol.asyncIterator]();

  // Pull the first chunk before responding. Auth, quota and model errors all
  // surface here, which lets us answer them with a real status code instead of
  // failing silently halfway through a 200 stream.
  let first: IteratorResult<string>;
  try {
    first = await chunks.next();
  } catch (error) {
    // A client that hung up before the first token is a normal cancellation,
    // not a provider failure — don't log it as one.
    if (request.signal.aborted) {
      return errorResponse("Request cancelled.", 499);
    }
    return aiErrorResponse(error);
  }

  if (first.done) {
    return errorResponse(
      "The model returned an empty response. Try again.",
      502,
    );
  }

  const encoder = new TextEncoder();
  let pending: string | null = first.value;
  // Set when the client hangs up. A pull already awaiting the provider will
  // still resolve afterwards, and touching a closed controller throws — so
  // every post-await path re-checks this first.
  let cancelled = false;

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (cancelled) return;

      if (pending !== null) {
        controller.enqueue(encoder.encode(pending));
        pending = null;
        return;
      }

      try {
        const next = await chunks.next();
        if (cancelled) return;

        if (next.done) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(next.value));
      } catch (error) {
        if (cancelled) return;
        console.error("[api/generate] stream interrupted", error);
        controller.error(error);
      }
    },
    async cancel() {
      cancelled = true;
      await chunks.return?.(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
