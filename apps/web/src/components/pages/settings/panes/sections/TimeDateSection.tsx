'use client';

import { useState } from 'react';
import { SettingsSection, FieldLabel } from '../primitives';
import { RadioRow } from '../controls';

const WEEK_START = ['Sunday', 'Monday'];
const TIME_FORMAT = ['24 Hour', '12 Hour'];
const DATE_FORMAT = ['mm/dd/yyyy', 'dd/mm/yyyy', 'yyyy/mm/dd'];

export function TimeDateSection() {
  const [weekStart, setWeekStart] = useState('Sunday');
  const [timeFormat, setTimeFormat] = useState('12 Hour');
  const [dateFormat, setDateFormat] = useState('mm/dd/yyyy');

  return (
    <SettingsSection
      label="Time & Date format"
      description="Select the way time & dates are displayed."
    >
      <div>
        <FieldLabel>Start of the calendar week</FieldLabel>
        <div className="flex flex-col gap-2.5">
          {WEEK_START.map((v) => (
            <RadioRow
              key={v}
              label={v}
              checked={weekStart === v}
              onSelect={() => setWeekStart(v)}
            />
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>Time format</FieldLabel>
        <div className="flex flex-col gap-2.5">
          {TIME_FORMAT.map((v) => (
            <RadioRow
              key={v}
              label={v}
              checked={timeFormat === v}
              onSelect={() => setTimeFormat(v)}
            />
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>Date format</FieldLabel>
        <div className="flex flex-col gap-2.5">
          {DATE_FORMAT.map((v) => (
            <RadioRow
              key={v}
              label={v}
              checked={dateFormat === v}
              onSelect={() => setDateFormat(v)}
            />
          ))}
        </div>
      </div>
    </SettingsSection>
  );
}
