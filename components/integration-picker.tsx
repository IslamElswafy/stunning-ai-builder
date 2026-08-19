"use client";

import { IntegrationCard } from "@/components/integration-card";
import { INTEGRATIONS, type IntegrationId } from "@/lib/integrations";

type Props = {
  selected: ReadonlySet<IntegrationId>;
  disabled: boolean;
  onToggle: (id: IntegrationId) => void;
};

export function IntegrationPicker({ selected, disabled, onToggle }: Props) {
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-1 text-sm font-medium text-ink">
        Tools to build with
      </legend>
      <p className="mb-3 text-xs text-muted">
        Optional. Selected tools are injected into the AI&rsquo;s system prompt
        and shape the plan it writes.
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRATIONS.map((integration) => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            selected={selected.has(integration.id)}
            disabled={disabled}
            onToggle={() => onToggle(integration.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}
