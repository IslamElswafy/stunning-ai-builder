# Decisions

The framing for this build: *this feature ships to production tomorrow and I have 60 minutes to make it better.* That budget went into correctness, failure states, and the things a user actually feels — not into architecture I would have to justify later.

## What did you improve?

**Server-side validation with an allow-list.** `lib/validation.ts` rejects a non-string prompt, a prompt under 10 or over 2000 characters, a non-array `integrationIds`, and any integration ID not in the supported set. Integration IDs are checked against `lib/integrations.ts`, so an arbitrary string can never reach the prompt builder. Every rejection is a `400` with a message written for a human. Verified against malformed JSON, wrong types, both length bounds, and a forged `"hubspot"` ID.

**The API key never leaves the server.** It is read in one place — `lib/ai.ts`, imported only by the route handler — and it is not prefixed `NEXT_PUBLIC_`, so Next.js will not inline it into the client bundle. I grepped the rendered HTML to confirm nothing leaks.

**Errors that say something true, without leaking internals.** A missing key returns `503` naming the exact environment variable to add. A provider failure returns `502`. Stack traces go to the server log only. The route pulls the *first* stream chunk before returning a `Response`, so auth and quota failures arrive as real status codes rather than as a `200` that dies halfway through.

**Streaming, and the disconnect bug it exposed.** The plan renders token by token. Testing a mid-stream client hang-up surfaced a real defect: an in-flight `pull()` resolved after `cancel()` had already closed the controller, throwing `ERR_INVALID_STATE` and logging a bogus "stream interrupted" error on what was a normal user cancellation. The route now tracks a `cancelled` flag and re-checks it after every await. Re-tested with three consecutive mid-stream disconnects: clean logs, and full reads still complete.

**Real UX states, not just a spinner.** Empty state before the first run, skeleton lines while the model is still thinking, streaming text with a caret, an error card, and a distinct "ready" header state. Submit is disabled during generation and `generate()` returns early if it is re-entered, so duplicate submissions are impossible from either a double click or an Enter-mash. A Stop button aborts the fetch, which propagates through `request.signal` and cancels the upstream model call rather than leaving it billing in the background.

**Accessibility that works with a keyboard and a screen reader.** Integration cards are real `<button>`s with `aria-pressed`, inside a `<fieldset>`/`<legend>`, so they tab and toggle natively. The textarea has a real `<label>`, plus `aria-invalid` and `aria-describedby` wired to the validation message. The result panel is a labelled `<section>` with `aria-busy` and a single `aria-live="polite"` status line — the streaming body itself is not a live region, which would otherwise re-announce on every token. There is a visible focus ring and a `prefers-reduced-motion` block.

**Markdown rendered without an HTML sink.** The renderer builds React elements; there is no `dangerouslySetInnerHTML` and no sanitiser to misconfigure. I server-rendered it against hostile input — `<script>alert(1)</script>` and `<img src=x onerror=...>` both come out escaped as text.

**Responsive by construction.** One column on mobile, two at `sm`, three at `lg` for the integration grid; the composer and result panel are fluid within a `max-w-3xl` column.

## What did you intentionally leave out?

**Authentication and user accounts.** Nothing here is per-user. Adding auth would add a session store, a login screen, and a protected-route pattern without changing whether the core flow works. It is the first thing I would add in production — but as a deliberate next step, not as scaffolding shipped ahead of the need. See the risk section.

**A database and generation history.** Every request is stateless: prompt in, plan out. Persisting runs means schema, migrations, a connection pool, and a hosting decision, in exchange for a feature nobody asked for yet. If users start asking to revisit plans, that is the moment to add it.

**Real OAuth and live third-party calls.** Explicitly out of scope, and correctly so — the point of the feature is that integration *context* changes the model's output. Wiring genuine Stripe or Gmail credentials would multiply the surface area while proving nothing extra about the flow. The UI says so out loud in the footer rather than implying a connection that does not exist.

**A separate NestJS service.** I kept the API inside Next.js. For a single AI endpoint at this stage, another service means another deployment unit, another set of environment variables, and a CORS boundary — added complexity with no gain to the product or to validating the core flow. The seam that matters already exists in code: `lib/ai.ts` is the only file that knows about the provider, so lifting it into its own service later is a move, not a rewrite.

**A schema-validation library.** One small request shape did not justify a dependency. Hand-written checks let each failure return copy the UI shows verbatim. If the API grew past two or three endpoints I would switch to Zod rather than keep hand-rolling.

**An automated test suite.** With roughly two hours, tests of a single endpoint would have cost more than the manual verification I actually ran (every validation branch, the config-error path, incremental streaming, mid-stream disconnect, XSS escaping, and prompt variation across four integration selections). In production the first tests I would write are unit tests on `parseGenerateRequest` and a snapshot test on `buildSystemPrompt` — both are pure functions, both are the parts most likely to break quietly.

**Rate limiting, usage metering, and observability.** Deliberately deferred because they are the mitigation for the risk below, and doing them properly needs infrastructure (a shared counter, a metrics sink) that does not belong in a two-hour build.

## What is the biggest production risk?

**Uncontrolled AI API usage.** The endpoint is unauthenticated and every call costs real money at real latency. A script can hold it open in a loop; a front-page moment can do the same thing accidentally. The prompt-length cap and the token ceiling bound the cost of *one* request, but nothing bounds the number of requests, and there is no alert when the bill starts climbing.

It is also the risk that makes the others worse: no quota means no way to distinguish a burst from an attack, and a provider outage under load turns into a wall of `502`s with no fallback.

How I would mitigate it, roughly in the order I would ship it:

- **Rate limiting first** — per-IP, then per-account, at the edge. This is the single highest-leverage change and can land in an afternoon.
- **Authentication and per-user quotas**, so cost attaches to an identity and abuse is attributable rather than anonymous.
- **A request timeout and a hard token ceiling per user per day**, so a single pathological session cannot run unbounded.
- **Cost telemetry** — log token usage per request and alert on spend-rate, not just on error-rate. You want to find out from a dashboard, not from an invoice.
- **Provider fallback** — the `AI_MODEL` variable already makes the model swappable; a documented cheaper fallback model to fail over to during an outage or a spend spike is a small addition on top.
