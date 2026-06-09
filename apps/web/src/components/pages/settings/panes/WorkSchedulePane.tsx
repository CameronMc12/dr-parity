'use client';

import { useState } from 'react';
import { Card, CardRow, SectionLabel } from './sections/general-primitives';
import { GhostButton, SelectField } from './controls';
import { DayToggle, HolidayRow } from './sections/schedule-primitives';
import { PaneHeader } from './sections/spaces-primitives';

interface Holiday {
  id: string;
  name: string;
  date: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
type Day = (typeof DAYS)[number];

const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

const TIME_ZONES = [
  'Africa/Johannesburg',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Singapore',
  'Australia/Sydney',
];

const SEED_HOLIDAYS: Holiday[] = [
  { id: 'new-year', name: "New Year's Day", date: 'Jan 1' },
];

export function WorkSchedulePane() {
  const [workingDays, setWorkingDays] = useState<Record<Day, boolean>>({
    Mon: true,
    Tue: true,
    Wed: true,
    Thu: true,
    Fri: true,
    Sat: false,
    Sun: false,
  });
  const [startHour, setStartHour] = useState('09:00');
  const [endHour, setEndHour] = useState('17:00');
  const [timeZone, setTimeZone] = useState('Africa/Johannesburg');
  const [holidays, setHolidays] = useState<Holiday[]>(SEED_HOLIDAYS);

  const toggleDay = (day: Day) =>
    setWorkingDays((prev) => ({ ...prev, [day]: !prev[day] }));

  const removeHoliday = (id: string) =>
    setHolidays((prev) => prev.filter((h) => h.id !== id));

  const addHoliday = () =>
    setHolidays((prev) => [
      ...prev,
      { id: `holiday-${prev.length + 1}`, name: 'New holiday', date: 'Jan 1' },
    ]);

  return (
    <div className="mx-auto w-full max-w-[820px] px-6 pt-8 pb-16">
      <PaneHeader title="Work Schedule" />

      <Card>
        <div className="px-6 pt-5 pb-2">
          <SectionLabel>Working days</SectionLabel>
        </div>
        <div className="px-6 pb-5 flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <DayToggle
              key={day}
              day={day}
              active={workingDays[day]}
              onToggle={() => toggleDay(day)}
            />
          ))}
        </div>
      </Card>

      <Card>
        <div className="px-6 pt-5 pb-1">
          <SectionLabel>Working hours</SectionLabel>
        </div>
        <CardRow label="Start">
          <SelectField value={startHour} options={HOURS} onChange={setStartHour} />
        </CardRow>
        <CardRow label="End">
          <SelectField value={endHour} options={HOURS} onChange={setEndHour} />
        </CardRow>
      </Card>

      <Card>
        <div className="px-6 pt-5 pb-1">
          <SectionLabel>Time zone</SectionLabel>
        </div>
        <CardRow
          label="Workspace time zone"
          description="Used for due dates, reminders, and reporting."
        >
          <SelectField value={timeZone} options={TIME_ZONES} onChange={setTimeZone} />
        </CardRow>
      </Card>

      <Card>
        <div className="px-6 pt-5 pb-2 flex items-center justify-between">
          <SectionLabel>Holidays</SectionLabel>
          <GhostButton onClick={addHoliday}>Add holiday</GhostButton>
        </div>
        <div className="px-6 pb-4">
          {holidays.length === 0 ? (
            <p className="text-[13px] text-[#7b7b7b] py-2">No holidays added yet.</p>
          ) : (
            holidays.map((holiday) => (
              <HolidayRow
                key={holiday.id}
                name={holiday.name}
                date={holiday.date}
                onRemove={() => removeHoliday(holiday.id)}
              />
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
