'use client';

import { Badge, Button, Checkbox, NumberInput, Paper, TextInput, Textarea } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { CrawlRunStatus, HousingProfile, MatchResult } from '@/lib/contracts/housing';

type RankResponse = { matches: MatchResult[]; degraded: 'lifestyle'[] };

const initialProfile: HousingProfile = {
  budgetMonthlyPerPerson: 1500,
  minimumBeds: 1,
  moveInDate: null,
  requiresAccessibleUnit: false,
  roommateCount: 1,
  preferredAmenities: ['laundry', 'parking'],
  lifestyleText: '',
  priorities: ['affordability', 'amenities', 'lifestyle'],
};

const priorityLabels = { affordability: 'Affordability', amenities: 'Amenities', lifestyle: 'Lifestyle fit', commute: 'Commute' };

async function rankProfile(profile: HousingProfile): Promise<RankResponse> {
  const response = await fetch('/api/rank', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile),
  });
  if (!response.ok) throw new Error('Ranking is unavailable. Try again.');

  return response.json();
}

function ResultCard({ match, position }: { match: MatchResult; position: number }) {
  const fetched = new Date(match.sourceFetchedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return <Paper className="result-card" radius="lg" p="xl" withBorder>
    <div className="result-topline"><span>#{String(position).padStart(2, '0')}</span><div>
      {match.isDemo && <Badge color="gray" variant="light">Demo data</Badge>}
      {match.verificationFlags.length > 0 && <Badge color="orange" variant="light">Needs verification</Badge>}
    </div></div>
    <div className="result-heading"><div><h3>{match.address}</h3><p>{match.unit ? `Unit ${match.unit} · ` : ''}{match.rentBasis.replace('_', ' ')} rent</p></div><strong>{Math.round(match.score * 100)}<small>/100</small></strong></div>
    <div className="score-bars">{(['affordability', 'amenities', 'lifestyle'] as const).map((name) =>
      <div className="score-row" key={name}><span>{priorityLabels[name]}</span><div><i style={{ width: `${Math.round((match.componentScores[name] ?? 0) * 100)}%` }} /></div><b>{Math.round((match.componentScores[name] ?? 0) * 100)}</b></div>
    )}</div>
    <ul className="fact-list">{match.supportingFacts.slice(0, 4).map((fact) => <li key={fact}>{fact}</li>)}</ul>
    {match.verificationFlags.length > 0 && <p className="verification-note">{match.verificationFlags.join(' · ')}</p>}
    <div className="result-footer"><span>Source checked {fetched}</span><a href={match.sourceUrls[0]} target="_blank" rel="noopener noreferrer">View source ↗</a></div>
  </Paper>;
}

export default function HomePage() {
  const [profile, setProfile] = useState<HousingProfile>(initialProfile);
  const [submittedProfile, setSubmittedProfile] = useState<HousingProfile>(initialProfile);
  const [amenities, setAmenities] = useState('laundry, parking');
  const [teamToken, setTeamToken] = useState('');
  const [runId, setRunId] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const ranking = useQuery({ queryKey: ['ranking', submittedProfile], queryFn: () => rankProfile(submittedProfile) });
  const refresh = useQuery({
    queryKey: ['refresh', runId, teamToken], enabled: Boolean(runId && teamToken),
    queryFn: async (): Promise<CrawlRunStatus> => {
      const response = await fetch(`/api/refresh/${runId}`, { headers: { Authorization: `Bearer ${teamToken}` } });
      if (!response.ok) throw new Error('Could not read the run. Check the token and run ID.');

      return response.json();
    },
    refetchInterval: (query) => query.state.data && ['queued', 'running'].includes(query.state.data.status) ? 3000 : false,
  });

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedProfile({ ...profile, preferredAmenities: amenities.split(',').map((name) => name.trim()).filter(Boolean) });
  }

  function movePriority(index: number, direction: -1 | 1) {
    const next = [...profile.priorities];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    const updated = { ...profile, priorities: next };
    setProfile(updated);
    setSubmittedProfile({ ...updated, preferredAmenities: amenities.split(',').map((name) => name.trim()).filter(Boolean) });
  }

  async function startRefresh() {
    setRefreshError('');
    setRefreshing(true);
    try {
      const response = await fetch('/api/refresh', { method: 'POST', headers: { Authorization: `Bearer ${teamToken}`, 'Content-Type': 'application/json' }, body: '{}' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Could not start the refresh.');

      setRunId(data.runId);
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : 'Could not start the refresh.');
    } finally {
      setRefreshing(false);
    }
  }

  return <main className="app-shell">
    <header className="site-header"><a className="wordmark" href="/">H<span>↗</span>L <small>HACK THE LEASE</small></a><span>ANN ARBOR HOUSING LAB</span></header>
    <section className="hero"><div><p className="eyebrow">A clearer way to choose where you live</p><h1>Find a place that <em>fits your life.</em></h1><p>Set your priorities. Compare real listings. See the facts behind every match and the details you still need to verify.</p></div><div className="hero-mark" aria-hidden="true">01<br /><span>YOUR NEXT<br />PLACE STARTS<br />HERE ↗</span></div></section>
    <div className="workspace-grid">
      <aside className="profile-panel"><div className="section-kicker"><span>01 / YOUR PROFILE</span><span>EDIT ANYTIME</span></div><h2>What matters to you?</h2><p className="section-intro">Start with the essentials. Unknown listing details stay visible for verification.</p>
        <form onSubmit={submitProfile}>
          <div className="field-grid">
            <NumberInput label="Budget per person / month" prefix="$" min={0} value={profile.budgetMonthlyPerPerson ?? ''} onChange={(value) => setProfile({ ...profile, budgetMonthlyPerPerson: typeof value === 'number' ? value : null })} />
            <NumberInput label="Minimum bedrooms" min={0} value={profile.minimumBeds ?? ''} onChange={(value) => setProfile({ ...profile, minimumBeds: typeof value === 'number' ? value : null })} />
            <NumberInput label="Roommates" min={0} value={profile.roommateCount ?? ''} onChange={(value) => setProfile({ ...profile, roommateCount: typeof value === 'number' ? value : null })} />
            <TextInput label="Move-in by" type="date" value={profile.moveInDate ?? ''} onChange={(event) => setProfile({ ...profile, moveInDate: event.currentTarget.value || null })} />
          </div>
          <Checkbox mt="md" label="I need an accessible unit" checked={profile.requiresAccessibleUnit} onChange={(event) => setProfile({ ...profile, requiresAccessibleUnit: event.currentTarget.checked })} />
          <TextInput mt="lg" label="Preferred amenities" description="Separate with commas" value={amenities} onChange={(event) => setAmenities(event.currentTarget.value)} />
          <Textarea mt="lg" label="Lifestyle" description="For example: quiet study space, cooking, and cafés" value={profile.lifestyleText} onChange={(event) => setProfile({ ...profile, lifestyleText: event.currentTarget.value })} maxLength={2000} autosize minRows={2} />
          <div className="priority-heading"><h3>Rank your priorities</h3><span>50% · 30% · 20%</span></div>
          <ol className="priority-list">{profile.priorities.map((priority, index) => <li key={priority}><span>0{index + 1}</span><strong>{priorityLabels[priority]}</strong><div><button type="button" aria-label={`Move ${priorityLabels[priority]} higher`} disabled={index === 0} onClick={() => movePriority(index, -1)}>↑</button><button type="button" aria-label={`Move ${priorityLabels[priority]} lower`} disabled={index === 2} onClick={() => movePriority(index, 1)}>↓</button></div></li>)}</ol>
          <Button type="submit" fullWidth size="md" className="rank-button">Update matches ↗</Button>
        </form>
      </aside>
      <section className="results-panel" aria-live="polite"><div className="section-kicker"><span>02 / YOUR MATCHES</span><span>EXPLAINED, NOT GUESSED</span></div><div className="results-title"><div><h2>Places worth a look</h2><p>Top six matches for your profile and priorities.</p></div><span>{ranking.data?.matches.length ?? '—'} MATCHES</span></div>
        {ranking.isPending && <p className="results-message">Finding your matches…</p>}
        {ranking.isError && <p className="results-message error">{ranking.error.message}</p>}
        {ranking.data?.degraded.length ? <p className="results-message">Lifestyle scoring is temporarily unavailable. Other scores remain visible.</p> : null}
        {ranking.data?.matches.length === 0 && <p className="results-message">No listings meet the confirmed requirements. Adjust your profile to see more places.</p>}
        <div className="result-list">{ranking.data?.matches.slice(0, 6).map((match, index) => <ResultCard key={match.listingId} match={match} position={index + 1} />)}</div>
        <p className="results-footnote">Commute scoring needs travel estimates. Confirm rent, fees, and availability with each provider.</p>
      </section>
    </div>
    <details className="refresh-panel"><summary>Team refresh monitor <span>↗</span></summary><p>Enter a permitted Supabase access token to refresh sources or inspect a run. The token stays in this browser tab.</p><div className="refresh-controls"><TextInput label="Team access token" type="password" value={teamToken} onChange={(event) => setTeamToken(event.currentTarget.value)} /><TextInput label="Run ID" value={runId} onChange={(event) => setRunId(event.currentTarget.value)} /><Button onClick={startRefresh} loading={refreshing} disabled={!teamToken}>Refresh sources</Button></div>{refreshError && <p className="error">{refreshError}</p>}{refresh.isError && <p className="error">{refresh.error.message}</p>}{refresh.data && <div className="refresh-status"><strong>{refresh.data.status.toUpperCase()}</strong><span>{refresh.data.counts.processed} processed · {refresh.data.counts.newListings} new · {refresh.data.counts.updatedListings} updated · {refresh.data.counts.failedPages} failed pages</span></div>}</details>
  </main>;
}
