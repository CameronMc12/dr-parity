'use client';

import { useState } from 'react';
import { Card, CardRow, SectionLabel } from './sections/general-primitives';
import { CheckboxRow, RadioRow, SelectField } from './controls';
import { PaneHeader, Toggle } from './sections/fields-primitives';

/**
 * AI Notetaker — configure the AI meeting assistant. A master enable toggle,
 * per-meeting capture options, transcription language, and how summaries are
 * delivered. Matches ClickUp's AI Notetaker settings.
 */

type Delivery = 'email' | 'doc' | 'both';

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Japanese'];

const DELIVERY_OPTIONS: readonly { id: Delivery; label: string }[] = [
  { id: 'email', label: 'Email' },
  { id: 'doc', label: 'Post to Doc' },
  { id: 'both', label: 'Both' },
];

interface MeetingPrefs {
  autoJoin: boolean;
  recordAudio: boolean;
  generateSummary: boolean;
}

export function AiNotetakerPane() {
  const [enabled, setEnabled] = useState(true);
  const [meeting, setMeeting] = useState<MeetingPrefs>({
    autoJoin: true,
    recordAudio: true,
    generateSummary: true,
  });
  const [language, setLanguage] = useState('English');
  const [delivery, setDelivery] = useState<Delivery>('email');

  const setMeetingFlag = (key: keyof MeetingPrefs, value: boolean) =>
    setMeeting((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="mx-auto w-full max-w-[820px] px-6 pt-8 pb-16">
      <PaneHeader title="AI Notetaker" />

      <SectionLabel>General</SectionLabel>
      <Card>
        <CardRow
          label="Enable AI Notetaker"
          description="Let the AI Notetaker join your meetings to capture transcripts, action items and summaries automatically."
        >
          <Toggle
            checked={enabled}
            onChange={setEnabled}
            label="Enable AI Notetaker"
          />
        </CardRow>
      </Card>

      <SectionLabel>Meetings</SectionLabel>
      <Card>
        <CardRow label="Capture preferences" align="start">
          <div className="flex flex-col items-end gap-3">
            <CheckboxRow
              label="Auto-join scheduled meetings"
              checked={meeting.autoJoin}
              onChange={(v) => setMeetingFlag('autoJoin', v)}
            />
            <CheckboxRow
              label="Record audio"
              checked={meeting.recordAudio}
              onChange={(v) => setMeetingFlag('recordAudio', v)}
            />
            <CheckboxRow
              label="Generate summary"
              checked={meeting.generateSummary}
              onChange={(v) => setMeetingFlag('generateSummary', v)}
            />
          </div>
        </CardRow>
      </Card>

      <SectionLabel>Language</SectionLabel>
      <Card>
        <CardRow
          label="Transcription language"
          description="The AI Notetaker transcribes and summarises meetings in this language."
        >
          <SelectField
            value={language}
            options={LANGUAGES}
            onChange={setLanguage}
          />
        </CardRow>
      </Card>

      <SectionLabel>Summary delivery</SectionLabel>
      <Card>
        <CardRow label="Where to send summaries" align="start">
          <div className="flex flex-col items-start gap-3">
            {DELIVERY_OPTIONS.map((option) => (
              <RadioRow
                key={option.id}
                label={option.label}
                checked={delivery === option.id}
                onSelect={() => setDelivery(option.id)}
              />
            ))}
          </div>
        </CardRow>
      </Card>
    </div>
  );
}
