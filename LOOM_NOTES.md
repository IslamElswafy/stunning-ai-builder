# Loom notes

5 minutes, face and voice. Talking points, not a script — say them in your own words.

**Before you hit record**

- `npm run dev`, key in `.env.local`, browser at `localhost:3000`, one clean tab.
- Have the example prompt ready to paste: *"Build an online course platform."*
- Editor open on a second tab with `lib/prompt.ts` and `app/api/generate/route.ts` already open — don't hunt for files on camera.
- Do one throwaway generation before recording so the model is warm and you know roughly how long it takes.

---

### 0:00–0:30 — Problem and approach

- What this is: you describe a product idea, pick the tools you want to build with, and get back a practical build plan.
- The core loop is one screen and one round trip. That was deliberate — the whole assignment is about whether integration selection genuinely changes the AI's answer, so everything else stays out of the way.
- Say the honest bit up front: the integrations are context, not connections. Nothing is wired to Stripe. What they change is the system prompt.

### 0:30–2:00 — Product demo

Do this live, don't narrate a static screen.

1. Type **"Build an online course platform."** Select **Stripe** only. Generate.
2. While it streams, point out that it's streaming — no blank screen, no spinner-and-pray.
3. Read one line out of the **Integration usage → Stripe** section. It should be naming real objects — Checkout Sessions, `checkout.session.completed`, dunning on failed payment.
4. Now the money shot: **same prompt**, add **Gmail** and **Google Sheets**. Generate again.
5. Show the diff out loud: the plan now has sub-sections for email lifecycle and a reporting/ops spreadsheet that simply weren't there before, and the architecture section changed to accommodate them.
6. Mention the line under the header — "Written with Stripe, Gmail, Google Sheets in the system prompt" — that's the app telling you exactly what shaped the answer.

If you have seconds spare: hit **Generate** with an empty box to show the validation, or **Stop** mid-stream to show cancellation. Skip both if you're behind.

### 2:00–3:15 — Architecture

Keep it to the four files. Show `lib/prompt.ts` on screen.

- Next.js App Router, TypeScript, Tailwind. Frontend and backend in one repo.
- The browser posts `{ prompt, integrationIds }` to one route handler. That's the whole API.
- **The key never touches the browser.** It's read in `lib/ai.ts`, which only the server imports, and it's not `NEXT_PUBLIC_` prefixed. That's the non-negotiable part of this feature.
- **`lib/integrations.ts` is the single source of truth.** The selector UI, the server-side allow-list, and the system prompt all read from the same file — adding a sixth integration is one object.
- **`lib/prompt.ts` is where the demo you just saw actually happens.** Each integration carries a capability description written for the model, and the prompt tells it to give every selected tool a concrete job with named endpoints and webhook events. Empty selection gets a different instruction entirely — stay vendor-neutral.
- One nice detail if there's time: the route pulls the *first* stream chunk before it returns a response, so an auth or quota failure comes back as a real status code instead of a `200` that dies halfway through.

### 3:15–4:15 — Product and engineering decisions

- **No database, no auth, no OAuth.** Every request is stateless. None of the three would make this flow work better, and each is a real maintenance surface. They're the first things I'd add — when there's a reason.
- **No separate NestJS service.** One AI endpoint doesn't justify a second deployment unit and a CORS boundary. The seam that matters is already there: `lib/ai.ts` is the only file that knows the provider exists, so lifting it out later is a move, not a rewrite.
- **What I did spend the time on:** server-side validation with an integration allow-list, real loading and error states, no duplicate submissions, keyboard and screen-reader support, and a Markdown renderer with no `dangerouslySetInnerHTML` anywhere.
- **One thing testing actually caught** — worth saying, it's concrete: hanging up mid-stream threw an `ERR_INVALID_STATE` because an in-flight read resolved after the controller had closed. Fixed with a cancelled flag re-checked after every await. That bug only shows up if you actually pull the plug on a live stream.
- **Biggest production risk: uncontrolled AI usage.** The endpoint is unauthenticated and every call costs money. Rate limiting first, then auth with per-user quotas, then cost telemetry that alerts on spend rate rather than error rate.

### 4:15–4:50 — Latest technology

`TECH.md` — Claude Managed Agents, public beta April 2026.

- What it is: a hosted agent harness. Agent, environment, session, event stream. Anthropic runs the loop *and* the sandbox — bash, file ops, web access — instead of you building it.
- Why it's relevant to Stunning specifically: that's exactly the infrastructure a vibe-coding platform needs for the "prompt becomes a working app" path, and it's the least differentiated part of the product to build yourself.
- The honest limitations: it's beta, it's stateful by design so it's **not eligible for Zero Data Retention or a HIPAA BAA**, rate limits are per-organization which is awkward for multi-tenant, and it's architectural lock-in rather than a swappable SDK.
- My call: **yes for the async build path, no for the fast interactive path.** For something like this app, a single Messages API call answers in seconds — spinning up a session and a sandbox would add latency and cost to buy state the interaction never uses.

### 4:50–5:00 — Close

- One line: the whole thing is one screen, four small server-side files, and a system prompt that genuinely changes with what you select.
- Thanks — happy to walk through any of it.
