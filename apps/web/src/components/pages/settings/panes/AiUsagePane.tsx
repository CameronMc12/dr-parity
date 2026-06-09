'use client';

import { useState } from 'react';
import { Card } from './sections/general-primitives';
import { SelectField } from './controls';
import { PaneShell, CardHeader, Toggle, UsageMeter } from './sections/people-shared';

const DEFAULT_MODEL = 'ClickUp Brain (default)';
const MODELS = [DEFAULT_MODEL, 'GPT-4o', 'Claude 3.5 Sonnet', 'Gemini 1.5 Pro'];

export function AiUsagePane() {
  const [brainEnabled, setBrainEnabled] = useState(true);
  const [model, setModel] = useState<string>(DEFAULT_MODEL);

  return (
    <PaneShell title="AI Usage">
      <Card>
        <CardHeader title="ClickUp Brain" />
        <div className="flex items-center gap-4 px-6 py-5">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] text-white leading-tight">Enable ClickUp Brain</p>
            <p className="text-[13px] leading-[18px] text-[#7b7b7b] mt-1 max-w-[440px]">
              Use AI to summarise, write, and automate work across your Workspace.
            </p>
          </div>
          <Toggle checked={brainEnabled} onChange={setBrainEnabled} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Usage this month" />
        <div className="px-6 py-5">
          <UsageMeter label="120 / unlimited AI actions" fraction={0.12} />
          <p className="text-[13px] text-[#7b7b7b] mt-3">Usage resets on the 1st of each month.</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Models" />
        <div className="flex items-center gap-4 px-6 py-5">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] text-white leading-tight">Default model</p>
            <p className="text-[13px] leading-[18px] text-[#7b7b7b] mt-1 max-w-[440px]">
              The model used for new AI actions across your Workspace.
            </p>
          </div>
          <SelectField value={model} options={MODELS} onChange={setModel} />
        </div>
      </Card>
    </PaneShell>
  );
}
