# Build Planner

A single-screen AI product that turns a rough idea into a practical build plan. You describe what you want to build, pick the tools you want to work with (Stripe, Shopify, Gmail, Slack, Google Sheets), and the app streams back a structured plan covering the product, its features, an architecture, and how each selected tool fits in.

The integrations are context only — nothing is connected and no OAuth runs. What they do is change the **system prompt** the server sends to the model, so the same idea produces a visibly different plan depending on what you select.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS v4 |
| Language | TypeScript (strict) |
| AI | Anthropic Messages API via `@anthropic-ai/sdk`, default model `claude-opus-5` |
| Server | A single Next.js Route Handler — no separate backend |

## Local setup

```bash
git clone <your-repo-url>
cd stunning-ai-builder
npm install
cp .env.example .env.local
# add your key to .env.local, then:
npm run dev
```

Open http://localhost:3000.

### Environment variables

All server-side. Nothing is prefixed `NEXT_PUBLIC_`, so no key ever reaches the browser.

| Variable | Required | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key ([console](https://console.anthropic.com/settings/keys)). Read only inside `lib/ai.ts`, which runs on the server. |
| `AI_MODEL` | No | Overrides the model. Defaults to `claude-opus-5`. |

The app uses the provider's own variable name rather than a generic `AI_API_KEY`, because the official SDK expects it and one clearly-named variable beats an indirection layer around a single call site.

Without a key the app still builds and runs; a generation attempt returns a `503` naming the missing variable rather than failing silently.

## Production validation

```bash
npm run lint       # ESLint (Next.js 16 no longer lints during build)
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

## Architecture

```
Browser (client component)
  │  POST /api/generate  { prompt, integrationIds }
  ▼
Route handler  app/api/generate/route.ts
  │  1. validate      lib/validation.ts   (length limits + integration allow-list)
  │  2. build prompt  lib/prompt.ts       (integrations → system prompt)
  │  3. call model    lib/ai.ts           (API key lives here, server-only)
  ▼
Anthropic Messages API  (streaming)
  │
  ▼  text/plain chunked response
Browser renders Markdown as it arrives
```

Four files carry the whole flow, each with one job:

- **`lib/integrations.ts`** — the only place integrations are defined. The selector UI, server validation, and the system prompt all read from it.
- **`lib/validation.ts`** — parses the untrusted request body and returns a message safe to show the user.
- **`lib/prompt.ts`** — turns the selected integration IDs into system-prompt text, including per-integration capability notes and per-integration output requirements.
- **`lib/ai.ts`** — the only file that imports the provider SDK. Everything above it deals in "system prompt in, text chunks out".

The response streams. The route pulls the first chunk *before* returning a `Response`, so authentication, quota, and model errors come back as real status codes instead of a truncated `200`.

## Trade-offs

Short version — the reasoning is in [`DECISIONS.md`](./DECISIONS.md):

- No database, no auth, no OAuth: this is one stateless request/response flow, and none of them would make it work better.
- API stays inside Next.js rather than a separate NestJS service — one endpoint does not justify a second deployment unit.
- Streaming was worth the extra ~30 lines; a multi-second blank screen is the worst part of an un-streamed AI product.
- A ~200-line Markdown renderer instead of a dependency, because we control the output shape from our own system prompt, only six constructs are needed, and it keeps `dangerouslySetInnerHTML` out of the codebase entirely.

## Also in this repo

- [`DECISIONS.md`](./DECISIONS.md) — what was improved, what was left out, and the biggest production risk.
- [`TECH.md`](./TECH.md) — a recent technology relevant to this space, and whether it is worth adopting today.
- [`LOOM_NOTES.md`](./LOOM_NOTES.md) — speaking notes for the demo video.
