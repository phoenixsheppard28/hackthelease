"use client";

import { useState } from 'react';
import type { HousingProfile } from '@/lib/contracts/housing-profile';
import type { DaySimulation as Simulation } from '@/lib/simulation/day';
import type { DestinationWalk } from '@/lib/travel/types';
import { weekdays, type Weekday } from '@/lib/simulation/calendar-day';
import styles from './DaySimulation.module.scss';

export function DaySimulation({ profile, home, walks }: {
  profile: HousingProfile;
  home: { name: string; address: string };
  walks: DestinationWalk[];
}) {
  const [simulation, setSimulation] = useState<(Simulation & { calendarStatus: string; calendarDay: { date: string; events: { title: string; location: string; time: string }[] } | null }) | null>(null);
  const [weekday, setWeekday] = useState<Weekday>('Monday');
  const [scenario, setScenario] = useState<'good' | 'bad'>('good');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/day-simulation', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, home, weekday, walks: walks.map(({ name, minutes }) => ({ name, minutes })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create this day.');
      setSimulation(data);
      setScenario('good');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create this day.');
    } finally {
      setLoading(false);
    }
  }

  return <section id="day-simulation" className={styles.section} aria-label="Example day at this home">
    <div className={styles.controls}><label htmlFor="simulation-weekday">Choose a weekday</label><select id="simulation-weekday" value={weekday} onChange={event => { setWeekday(event.target.value as Weekday); setSimulation(null); }} disabled={loading}>{weekdays.map(day => <option key={day}>{day}</option>)}</select></div>
    {!simulation ? <button className={styles.start} onClick={generate} disabled={loading}>{loading ? 'Building your example days…' : `Build a ${weekday} at this home`}</button> : <>
      <div className={styles.heading}><div><span className={styles.eyebrow}>A day at this home</span><h2>Picture your week from here.</h2></div><button onClick={generate} disabled={loading}>{loading ? 'Building…' : 'Regenerate'}</button></div>
      <p className={styles.intro}>Two example {weekday} scenarios based on your profile and approved places. {simulation.calendarStatus} Weather and bus conditions are simulated.</p>
      {simulation.calendarDay && <div className={styles.commitments}><strong>Calendar anchors · {simulation.calendarDay.date}</strong><ul>{simulation.calendarDay.events.map((event, index) => <li key={`${event.time}-${index}`}>{event.time} · {event.title} · {event.location}</li>)}</ul></div>}
      <div className={styles.tabs} role="group" aria-label="Choose day scenario"><button aria-pressed={scenario === 'good'} onClick={() => setScenario('good')}>☀ Good day</button><button aria-pressed={scenario === 'bad'} onClick={() => setScenario('bad')}>☂ Hard day</button></div>
      <div className={styles.weather}><span>{scenario === 'good' ? '☀' : '☂'}</span><div><strong>{simulation[scenario].weather}</strong><p>{simulation[scenario].overview}</p></div></div>
      <ol className={styles.timeline}>{simulation[scenario].moments.map((moment, index) => <li key={`${index}-${moment.time}`}><time>{moment.time}</time><div><h3>{moment.title}</h3><span className={styles.place}>{moment.place}</span><p>{moment.description}</p><small>{moment.travel}</small></div></li>)}</ol>
      <p className={styles.takeaway}>{simulation[scenario].takeaway}</p>
      <p className={styles.source}>Walking estimates: Google Maps when available. Calendar events reflect one recent {weekday}, when connected. Other story details are AI-generated, not a forecast or bus timetable.</p>
    </>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </section>;
}
