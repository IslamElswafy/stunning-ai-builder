import { getIntegration, type IntegrationId } from "@/lib/integrations";

const ROLE = `You are an expert software product architect. You turn rough product ideas into practical, opinionated build plans that a small team could start on tomorrow.`;

const OUTPUT_CONTRACT = `## Output format

Reply in Markdown using exactly these five headings, in this order and with no others at that level:

## Product overview
## Core features
## Suggested architecture
## Integration usage
## Next steps

Rules:
- Stay under 600 words. Density beats completeness.
- Be concrete and opinionated. Name actual services, data models, endpoints and events instead of describing categories.
- Prefer tight bullets over paragraphs everywhere except "Product overview".
- No preamble, no sign-off, no restating the prompt. Begin with the first heading.`;

function describeSelected(integrationIds: IntegrationId[]): string {
  const list = integrationIds
    .map((id) => {
      const { name, capability } = getIntegration(id);
      return `- **${name}** — ${capability}.`;
    })
    .join("\n");

  return `## Selected integrations

The user has chosen to build with these third-party services. Treat the list as a fixed constraint on the architecture:

${list}

Rules for integrations:
- Give every selected service a concrete job in this specific product. Name the objects, endpoints or webhook events involved.
- Under "Integration usage", write one \`###\` sub-heading per selected service, in the order listed above.
- Do not introduce another vendor to solve a problem a selected service already covers.
- If a selected service genuinely does not fit this idea, say so plainly in one sentence and give the most useful role it could still play.`;
}

const NO_INTEGRATIONS = `## Selected integrations

The user selected none. Keep the plan vendor-neutral: describe the capability the product needs ("a payment provider", "a transactional email service") rather than naming specific products.

Under "Integration usage", list the two or three external services this product would most benefit from and say what each would be responsible for.`;

/**
 * Builds the system prompt for a generation request. The selected integrations
 * change both the capabilities described to the model and the shape it is asked
 * to produce, so different selections produce visibly different plans.
 */
export function buildSystemPrompt(integrationIds: IntegrationId[]): string {
  const integrationSection =
    integrationIds.length > 0
      ? describeSelected(integrationIds)
      : NO_INTEGRATIONS;

  return [ROLE, integrationSection, OUTPUT_CONTRACT].join("\n\n");
}

export function buildUserPrompt(idea: string): string {
  return `Here is the product idea:\n\n${idea.trim()}`;
}
