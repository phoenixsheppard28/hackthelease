import { describe, expect, it } from 'vitest';
import { representativeCalendarDay } from './calendar-day';

describe('representativeCalendarDay', () => {
  it('uses the busiest chosen weekday in Detroit and skips canceled events', () => {
    const events = [
      { summary: 'Class', start: { dateTime: '2026-11-16T15:00:00Z' } },
      { summary: 'Lab', start: { dateTime: '2026-11-16T18:00:00Z' } },
      { summary: 'Canceled', status: 'cancelled', start: { dateTime: '2026-11-16T20:00:00Z' } },
      { summary: 'Other Monday', start: { dateTime: '2026-11-09T15:00:00Z' } },
    ];
    expect(representativeCalendarDay(events, 'Monday')).toEqual({ date: '2026-11-16', events: [
      { title: 'Class', location: 'Location not specified', time: '10:00 AM' },
      { title: 'Lab', location: 'Location not specified', time: '1:00 PM' },
    ] });
    expect(representativeCalendarDay(events, 'Tuesday')).toBeNull();
  });
});
