"use client";

import Image from "next/image";
import Link from "next/link";
import { saveBrowseContext, type BrowseContext } from "@/lib/matching/browse-context";
import { Modal, UnstyledButton } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import type { HousingProfile } from "@/lib/contracts/housing-profile";
import { rentText, rentBasisText, type ListingMatch } from "@/lib/contracts/listing-match";
import { locationIncomplete, reweightMatches, walkingSummary } from "@/lib/matching/location-score";
import { useListingEvidence } from './useListingEvidence';
import { defaultWeights, type Weights } from "@/lib/contracts/matching-weights";
import { PrioritySliders } from "./PrioritySliders";
import { Icon } from "./Icon";
import surveyStyles from "./Onboarding.module.scss";
import styles from "./Results.module.scss";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

function ListingPhoto({ home, large = false }: { home: ListingMatch; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  return failed || !home.image ? <div className={styles.photoFallback}><Icon name="house" size={32} /><span>Photo unavailable</span></div>
    : <Image src={home.image} alt={`Property photo for ${home.name}`} fill
      sizes={large ? "(max-width: 700px) 100vw, 760px" : "(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 25vw"}
      className={styles.photo} onError={() => setFailed(true)} />;
}

export function Results({ profile, profileId = "current", onBack, initialBrowse }: { profile: HousingProfile; profileId?: string; onBack: () => void; initialBrowse?: BrowseContext }) {
  const [weights, setWeights] = useState<Weights>(() => ({ ...(initialBrowse?.weights ?? profile.weights ?? defaultWeights) }));
  const [query, setQuery] = useState(initialBrowse?.query ?? "");
  const [homeType, setHomeType] = useState<BrowseContext["homeType"]>("All homes");
  const [view, setView] = useState<"homes" | "saved">(initialBrowse?.view ?? "homes");
  const [saved, setSaved] = useState<string[]>([]);
  const [prioritiesOpen, setPrioritiesOpen] = useState(false);
  useEffect(() => {
    saveBrowseContext(profileId, { profile, weights, query, homeType, view });
  }, [profileId, profile, weights, query, homeType, view]);
  const storageKey = `hackthelease:saved:${profileId || profile.name}`;
  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || "[]");
      setSaved(Array.isArray(value) ? value.filter(id => typeof id === "string") : []);
    } catch { setSaved([]); }
  }, [storageKey]);
  function toggleSaved(id: string) {
    const next = saved.includes(id) ? saved.filter(value => value !== id) : [...saved, id];
    setSaved(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Favorites still work for this visit. */ }
  }
  const matches = useListingEvidence(profileId, profile);
  const ranked = useMemo(() => reweightMatches(matches.data?.matches ?? [], weights), [matches.data, weights]);
  const homes = ranked.filter(home =>
    (view !== "saved" || saved.includes(home.id)) &&
    (homeType === "All homes" || home.type === homeType) &&
    `${home.name} ${home.area} Ann Arbor`.toLowerCase().includes(query.trim().toLowerCase())
  );
  const allZero = Object.values(weights).every(value => value === 0);

  return <div className={`${surveyStyles.shell} ${styles.browser}`}>
    <header className={styles.header}>
      <UnstyledButton className={styles.brand} onClick={onBack}><Icon name="house" size={27} />Hack the Lease</UnstyledButton>
      <nav className={styles.tabs} aria-label="Browse listings">
        <UnstyledButton aria-current={view === "homes" ? "page" : undefined} onClick={() => setView("homes")}>Homes</UnstyledButton>
        <UnstyledButton aria-current={view === "saved" ? "page" : undefined} onClick={() => setView("saved")}>Saved{saved.length ? ` (${saved.length})` : ""}</UnstyledButton>
      </nav>
      <UnstyledButton className={styles.student} onClick={onBack} aria-label="Switch student"><span className={styles.avatar}>{profile.name.slice(0, 1).toUpperCase()}</span><span>{profile.name}</span></UnstyledButton>
    </header>
    <div className={styles.searchArea}>
      <div className={styles.searchBar} role="search">
        <label className={styles.searchField}><span>Where</span><input aria-label="Search homes or areas" placeholder="Search Ann Arbor homes" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className={styles.budgetSummary}><span>Your budget</span><strong>{money(profile.budget)}<small> / {profile.basis === "Just me" ? "person" : "group"} / mo</small></strong></div>
        <label className={styles.typeField}><span>Home type</span><select disabled title="Property type has not been verified in the listing data yet" aria-label="Home type" value={homeType} onChange={event => setHomeType(event.target.value as BrowseContext["homeType"])}><option>All homes</option><option>Apartment</option><option>House</option></select></label>
        <div className={styles.searchIcon} aria-hidden="true"><Icon name="search" size={22} /></div>
      </div>
    </div>
    <main className={styles.main}>
      <div className={styles.headingRow}>
        <div><h1>{view === "saved" ? "Your saved homes" : "Your best matches in Ann Arbor"}</h1><p>{matches.isPending ? "Checking homes and walking routes…" : `${homes.length} ${homes.length === 1 ? "home" : "homes"}`}<span>{allZero ? ' · Set priorities to rank' : ' · Best match first'}</span></p></div>
        <UnstyledButton className={styles.prioritiesButton} onClick={() => setPrioritiesOpen(true)}><Icon name="sliders" size={18} />Your priorities</UnstyledButton>
      </div>
      <p className={styles.demoNote}>Live listings · {matches.data?.totalListings ?? "…"} active properties checked against your budget and bedroom needs</p>
      {matches.data && <details className={styles.matchingNotes}><summary>What’s included in your match?</summary>{matches.data.notices.map(notice => <p key={notice}>{notice}</p>)}</details>}
      {matches.data?.matches.some(home => home.destinations.some(place => place.status === 'ok')) && <p className={styles.demoNote}>Walking estimates: Google Maps · May not include all sidewalks or pedestrian paths. Building access and weather can change your trip.</p>}
      <div aria-live="polite" className={styles.loadingStatus}>{matches.isFetching && !matches.isPending ? "Updating your matches…" : ""}</div>
      {matches.isPending ? <div className={styles.empty} role="status">Finding homes and checking walks to your three places…</div>
        : matches.isError ? <div className={styles.empty} role="alert"><h2>We couldn’t load your matches.</h2><button onClick={() => matches.refetch()}>Try again</button></div>
        : allZero ? <div className={styles.empty}><h2>Choose what matters to you.</h2><p>Give at least one priority a value above zero.</p><button onClick={() => setPrioritiesOpen(true)}>Adjust priorities</button></div>
        : !homes.length ? <div className={styles.empty}><h2>{allZero ? "Choose what matters to you." : view === "saved" && !saved.length ? "Your favorites will live here." : "No homes match this search."}</h2><p>{allZero ? "Give at least one priority a value above zero." : view === "saved" && !saved.length ? "Tap the heart on a home to save it." : "Try another search, or review your budget and bedroom needs."}</p><button onClick={() => {
          if (allZero) setPrioritiesOpen(true);
          else { setQuery(""); setHomeType("All homes"); setView("homes"); }
        }}>{allZero ? "Adjust priorities" : "Browse all homes"}</button></div>
        : <div className={styles.grid}>{homes.map(home => {
          const favorite = saved.includes(home.id);
          return <article key={home.id} className={styles.card}>
            <div className={styles.imageWrap}>
              <Link className={styles.openPhoto} aria-label={`View ${home.name}`} href={`/listings/${home.id}?profile=${encodeURIComponent(profileId)}`}><ListingPhoto home={home} /></Link>
              <span className={styles.matchBadge}>{home.score === null ? "Unscored" : locationIncomplete(home, weights) ? `${home.score} · Partial score` : `${home.score}% match`}</span>
              <UnstyledButton className={styles.favorite} data-saved={favorite} aria-label={`${favorite ? "Unsave" : "Save"} ${home.name}`} aria-pressed={favorite} onClick={() => toggleSaved(home.id)}><Icon name="heart" size={23} /></UnstyledButton>
            </div>
            <Link className={styles.cardTitle} href={`/listings/${home.id}?profile=${encodeURIComponent(profileId)}`}>{home.name}</Link>
            <p>{home.area} · {home.beds === null ? "Bedrooms unconfirmed" : `${home.beds} bedrooms`}</p>
            <p className={styles.verification}>{walkingSummary(home, profile.walk)}</p>
            <p className={styles.price}><strong>{rentText(home)}</strong>{rentBasisText(home)}</p>
          </article>;
        })}</div>}
    </main>
    <Modal opened={prioritiesOpen} onClose={() => setPrioritiesOpen(false)} title="What matters most to you?" size={740} centered radius={20} closeButtonProps={{ "aria-label": "Close priorities" }}>
      <div className={`${surveyStyles.shell} ${styles.modalBody}`}><div className={styles.demoNote}>{matches.data?.notices.map(notice => <p key={notice}>{notice}</p>)}</div><PrioritySliders weights={weights} onChange={setWeights} /><button className={styles.doneButton} onClick={() => setPrioritiesOpen(false)}>Done</button></div>
    </Modal>
  </div>;
}
