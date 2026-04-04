import { useMemo } from 'react';
import { formatTime12h } from '../utils/timeDisplay';

type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

type DaySchedule = {
  closed: boolean;
  open: string;
  close: string;
};

export type WeeklySchedule = Record<Weekday, DaySchedule>;

const WEEK_DAYS: Array<{ key: Weekday; label: string }> = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const DAY_ALIASES: Record<string, Weekday> = {
  mon: 'monday',
  monday: 'monday',
  tue: 'tuesday',
  tues: 'tuesday',
  tuesday: 'tuesday',
  wed: 'wednesday',
  wednesday: 'wednesday',
  thu: 'thursday',
  thur: 'thursday',
  thurs: 'thursday',
  thursday: 'thursday',
  fri: 'friday',
  friday: 'friday',
  sat: 'saturday',
  saturday: 'saturday',
  sun: 'sunday',
  sunday: 'sunday',
};

function createDefaultWeeklySchedule(): WeeklySchedule {
  return {
    monday: { closed: false, open: '09:00', close: '17:00' },
    tuesday: { closed: false, open: '09:00', close: '17:00' },
    wednesday: { closed: false, open: '09:00', close: '17:00' },
    thursday: { closed: false, open: '09:00', close: '17:00' },
    friday: { closed: false, open: '09:00', close: '17:00' },
    saturday: { closed: false, open: '09:00', close: '17:00' },
    sunday: { closed: false, open: '09:00', close: '17:00' },
  };
}

function normalizeTime(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? `${match[1]}:${match[2]}` : fallback;
}

function parseStringRange(value: string): { open: string; close: string } | null {
  const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return {
    open: `${match[1]}:${match[2]}`,
    close: `${match[3]}:${match[4]}`,
  };
}

function readDaySchedule(input: unknown, fallback: DaySchedule): DaySchedule {
  if (!input || typeof input !== 'object') return fallback;
  const source = input as Record<string, unknown>;

  const closed = source.closed === true || source.isClosed === true || source.open === false;
  const open = normalizeTime(source.open, fallback.open);
  const close = normalizeTime(source.close, fallback.close);

  return { closed, open, close };
}

function toWeeklySchedule(input?: Record<string, unknown> | null): WeeklySchedule {
  const result = createDefaultWeeklySchedule();
  if (!input || typeof input !== 'object') return result;

  Object.entries(input).forEach(([rawKey, value]) => {
    const key = DAY_ALIASES[rawKey.toLowerCase()];
    if (!key) return;
    if (typeof value === 'string') {
      const range = parseStringRange(value);
      if (range) result[key] = { closed: false, ...range };
      return;
    }
    result[key] = readDaySchedule(value, result[key]);
  });

  return result;
}

export function weeklyScheduleToPayload(schedule: WeeklySchedule): Record<string, unknown> {
  return WEEK_DAYS.reduce<Record<string, unknown>>((acc, day) => {
    const value = schedule[day.key];
    acc[day.key] = {
      closed: value.closed,
      open: value.open,
      close: value.close,
    };
    return acc;
  }, {});
}

export function createDefaultWorkingHoursPayload(): Record<string, unknown> {
  return weeklyScheduleToPayload(createDefaultWeeklySchedule());
}

export function validateWorkingHoursPayload(payload: Record<string, unknown>): string | null {
  const schedule = toWeeklySchedule(payload);
  for (const day of WEEK_DAYS) {
    const current = schedule[day.key];
    if (current.closed) continue;
    if (!current.open || !current.close) {
      return `${day.label}: open and close times are required unless closed.`;
    }
    if (current.open >= current.close) {
      return `${day.label}: close time must be after open time.`;
    }
  }
  return null;
}

type Props = {
  value?: Record<string, unknown> | null;
  onChange: (value: Record<string, unknown>) => void;
};

export default function WorkingHoursEditor({ value, onChange }: Props) {
  const schedule = useMemo(() => toWeeklySchedule(value), [value]);

  function updateDay(day: Weekday, next: Partial<DaySchedule>) {
    const nextSchedule: WeeklySchedule = {
      ...schedule,
      [day]: { ...schedule[day], ...next },
    };
    onChange(weeklyScheduleToPayload(nextSchedule));
  }

  return (
    <div>
      <label>Working hours *</label>
      <p className="muted" style={{ margin: '0.35rem 0 0.6rem' }}>
        Set each day&apos;s schedule. Mark a day as closed if no bookings are allowed. Times are stored
        as 24-hour (HH:mm) for the API; 12-hour labels show next to each field.
      </p>
      <div style={{ display: 'grid', gap: '0.45rem' }}>
        {WEEK_DAYS.map((day) => {
          const valueForDay = schedule[day.key];
          return (
            <div key={day.key} className="form-row-2" style={{ alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <strong style={{ minWidth: '84px' }}>{day.label}</strong>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={valueForDay.closed}
                    onChange={(e) => updateDay(day.key, { closed: e.target.checked })}
                  />
                  Closed
                </label>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '0.35rem 0.5rem',
                }}
              >
                <input
                  type="time"
                  value={valueForDay.open}
                  onChange={(e) => updateDay(day.key, { open: e.target.value })}
                  disabled={valueForDay.closed}
                />
                {!valueForDay.closed && (
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    {formatTime12h(valueForDay.open)}
                  </span>
                )}
                <span className="muted">to</span>
                <input
                  type="time"
                  value={valueForDay.close}
                  onChange={(e) => updateDay(day.key, { close: e.target.value })}
                  disabled={valueForDay.closed}
                />
                {!valueForDay.closed && (
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    {formatTime12h(valueForDay.close)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
