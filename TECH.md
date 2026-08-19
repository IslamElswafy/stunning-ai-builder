# Claude Managed Agents

Chosen because it is the closest recent release to what an AI vibe-coding platform actually has to build: a place for an agent loop to run for a long time, with a sandbox, without the platform team owning that infrastructure.

Sources are Anthropic's own documentation, checked while writing this: the [Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview), the [reference page](https://platform.claude.com/docs/en/managed-agents/reference), and the [self-hosted sandboxes guide](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes). Public beta launched **April 2026**; self-hosted sandboxes and MCP tunnels were announced at Code with Claude London in **May 2026**. Everything below that is specific — header strings, endpoint paths, rate limits — comes from those pages rather than from memory.

## What is it?

A hosted agent harness. Instead of writing your own agent loop, you configure one and Anthropic runs it.

The API is built around four objects:

| Object | What it is |
| --- | --- |
| **Agent** | The model, system prompt, tools, MCP servers, and skills. Created once, referenced by ID, versioned. |
| **Environment** | Where sessions run — an Anthropic-managed cloud sandbox, or a self-hosted one on your own infrastructure. |
| **Session** | A running instance of an agent inside an environment, working on one task. |
| **Events** | The bidirectional stream — user turns in, agent messages, tool calls, and status transitions out over SSE. |

You `POST /v1/agents` once, `POST /v1/environments` once, then `POST /v1/sessions` per task and stream events. All endpoints require the `managed-agents-2026-04-01` beta header, which the SDKs set automatically.

The important part is what you stop owning. Claude gets bash, file read/write/edit/glob/grep, web search and fetch, and MCP servers — executing inside a sandbox Anthropic provisions and tears down. Sessions are stateful: the filesystem and conversation history persist across turns, so a session can pause and resume. Prompt caching, context compaction, and retry/error recovery are built into the harness rather than being your problem. You can steer a running agent mid-execution or interrupt it.

The distinction that matters against the plain Messages API: the Messages API gives you direct model access and you build the loop. Managed Agents gives you the loop *and* the machine it runs on.

## How could Stunning use it?

The natural fit is the asynchronous half of a vibe-coding platform — the part where a user's prompt becomes a working app rather than a chat reply.

**Per-user build sessions.** A user describes what they want; Stunning creates a session against a pre-built "app builder" agent and mounts the user's project. Claude scaffolds files, runs the dev server, reads the errors, and fixes them — all inside an isolated sandbox, one per user, with no container orchestration on Stunning's side. This is precisely the infrastructure that is expensive to build in-house and unglamorous to operate: sandbox provisioning, cleanup, resource limits, tenant isolation.

**Streaming the build into the UI.** The session event stream (`agent.tool_use`, `agent.message`, `session.status_idle`) maps almost directly onto a "watch it build" panel. That live-progress view is a big part of why vibe-coding products feel magical, and here it is a byproduct of the API rather than a system to design.

**Long tasks that outlive a request.** "Migrate this project to TypeScript" or "add Stripe checkout across these six files" runs for minutes. Sessions are built for exactly that, and they survive a page refresh — which a request-scoped agent loop on your own servers does not, without you building the persistence.

**Agent versioning as a release channel.** Agents are versioned resources and sessions can pin a version. That means shipping a new system prompt to 10% of new sessions while everything in flight keeps running on the old one — a real A/B and rollback mechanism for prompt changes, which is normally hand-rolled config.

**Scheduled and self-hosted variants.** Scheduled deployments cover recurring jobs (nightly dependency upgrades, a weekly health pass over a user's project). Self-hosted sandboxes matter for the enterprise conversation: tool execution moves inside the customer's perimeter, which is often the blocker for a regulated buyer.

## What are its limitations?

**It is beta, and the docs say behavior may be refined between releases.** For a platform whose core loop depends on it, that is a real operational commitment — you are tracking someone else's release notes for changes that alter agent behavior, not just API signatures.

**No Zero Data Retention and no HIPAA BAA.** This one is the sharpest. Managed Agents is stateful by design — conversation history, sandbox state, and outputs are stored server-side — and Anthropic states plainly that this makes it ineligible for ZDR and for BAA coverage. You can delete sessions and files through the API, but "we can delete it on request" is a different answer from "we never retain it", and enterprise security reviews treat them differently. If Stunning's roadmap includes healthcare or a customer with a strict data-residency posture, this constrains where Managed Agents can be the answer.

**Self-hosted sandboxes are not a full data-isolation story.** They move tool execution and network egress into your infrastructure, but tool inputs and outputs still flow to Anthropic's control plane — the model has to see results to decide what to do next. That is the honest boundary, and it is worth stating clearly to a customer rather than letting "self-hosted" imply more than it delivers. It also hands the operational burden back: container hardening, egress policy, and environment-key custody become yours.

**Rate limits are per organization, and a multi-tenant platform is the awkward case.** 300 requests/minute on create endpoints and 1,200/minute on reads, plus normal org spend and usage-tier limits. Every user's build session draws from one shared pool, so a traffic spike is a platform-wide event, not a per-user one. That is a capacity-planning problem you have to solve before it bites, not after.

**It is architectural lock-in, not just a vendor call.** With the Messages API, the loop is yours and swapping providers is a client change — the seam in this repo's `lib/ai.ts` is exactly that. Agents, sessions, and environments are Anthropic-proprietary resources with no equivalent elsewhere; building the product's core loop on them means a migration would be a rewrite of the runtime, not a swap of an SDK.

**Cost is time-based as well as token-based.** Session running time counts toward spend, which changes the shape of the bill. A user who leaves a session idle costs money in a way a stateless API call does not, so idle-timeout policy becomes a product decision rather than an afterthought.

**Branding is constrained.** Partners cannot name the feature "Claude Code" or mimic its visual identity, and there are rules for how Claude may be referenced. Minor, but it lands on the design and marketing side and is better known up front.

**MCP tunnels and dreaming are a narrower research preview** requiring separate access, so the private-MCP story is not something to promise a customer on a roadmap slide yet.

## Would you use it today? Why or why not?

**Yes for the asynchronous build path — no for the interactive one.** The split is the whole answer.

For the long-running "turn this prompt into a working app" flow, I would use it today, and I would start now rather than wait for GA. The alternative is building sandbox provisioning, tenant isolation, session persistence, and an agent loop with compaction and retry — months of work in the least differentiated part of the product. Nothing about a vibe-coding platform's value lives in its container scheduler. The beta caveats are real but manageable: they are operational risks you monitor, not correctness risks that break users.

For the fast interactive path — this very app, or a "rename this component" edit — I would not. A single Messages API call answers in seconds. Provisioning a session and a sandbox for it would add latency and cost to buy stateful infrastructure the interaction never uses. Managed Agents is the wrong tool for anything that fits in one request/response, and reaching for it there would be exactly the kind of complexity-for-its-own-sake this project deliberately avoided.

Two conditions I would attach before it carried real traffic. First, prove the rate-limit math against projected concurrent sessions before it is load-bearing — a per-organization ceiling on a multi-tenant platform is the failure that arrives on your best traffic day. Second, keep the interactive path on the Messages API and behind an interface like this repo's `lib/ai.ts`, so the fast flow stays portable even while the async flow is deliberately committed to Anthropic.

And I would go in clear-eyed that this is a strategic bet, not a library choice. Adopting Managed Agents for the core loop means Anthropic's harness *is* the product's runtime. That is a good trade when the runtime is not where you compete — but it should be made on purpose, with the ZDR and lock-in consequences written down, not discovered later.
