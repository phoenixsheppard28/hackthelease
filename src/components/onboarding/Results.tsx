"use client";

import Image from "next/image";
import Link from "next/link";
import { saveBrowseContext, type BrowseContext } from "@/lib/matching/browse-context";
import { Menu, Modal, UnstyledButton } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { HousingProfile } from "@/lib/contracts/housing-profile";
import { rentText, rentBasisText, type ListingMatch, type ListingMatchesResponse } from "@/lib/contracts/listing-match";
import { defaultWeights, type Weights } from "@/lib/contracts/matching-weights";
import { locationIncomplete, reweightMatches, walkingSummary } from "@/lib/matching/location-score";
import { useListingEvidence } from "./useListingEvidence";
import { PrioritySliders } from "./PrioritySliders";
import { Icon } from "./Icon";
import { GroupDialog } from "@/components/groups/GroupDialog";
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

export function Results({ profile, profileId = "current", onBack, initialBrowse, initialGroupOpen = false }: { profile: HousingProfile; profileId?: string; onBack: () => void; initialBrowse?: BrowseContext; initialGroupOpen?: boolean }) {
  const queryClient = useQueryClient();
  const [weights, setWeights] = useState<Weights>(() => ({ ...(initialBrowse?.weights ?? profile.weights ?? defaultWeights) }));
  const [query, setQuery] = useState(initialBrowse?.query ?? "");
  const [homeType, setHomeType] = useState<BrowseContext["homeType"]>("All homes");
  const [view, setView] = useState<"homes" | "saved">(initialBrowse?.view ?? "homes");
  const [saved, setSaved] = useState<string[]>([]);
  const [savedError, setSavedError] = useState("");
  const [priorityError, setPriorityError] = useState("");
  const [prioritiesOpen, setPrioritiesOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(initialGroupOpen);
  const [accountError, setAccountError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const group = useQuery<{ group: { id: string; name: string } | null }>({
    queryKey: ["housing-group"], enabled: profileId !== "demo-preview",
    refetchInterval: 15000,
    queryFn: async () => {
      const response = await fetch("/api/groups");
      if (!response.ok) throw new Error("Could not load your housing group.");
      return response.json();
    },
  });
  const groupId = group.data?.group?.id;
  const groupSaves = useQuery<{ ids: string[] }>({
    queryKey: ["group-saves", groupId], enabled: Boolean(groupId),
    refetchInterval: groupId ? 15000 : false,
    queryFn: async () => {
      const response = await fetch("/api/groups/saves");
      if (!response.ok) throw new Error("Could not load saved homes.");
      return response.json();
    },
  });
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
  const savedIds = groupId ? groupSaves.data?.ids ?? [] : saved;
  async function toggleSaved(id: string) {
    if (groupId) {
      setSavedError("");
      try {
        const response = await fetch("/api/groups/saves", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId: id, saved: !savedIds.includes(id) }) });
        if (!response.ok) throw new Error("Could not update the group's saved homes.");
        await queryClient.invalidateQueries({ queryKey: ["group-saves", groupId] });
      } catch (error) { setSavedError(error instanceof Error ? error.message : "Could not save this home."); }
      return;
    }

    const next = saved.includes(id) ? saved.filter(value => value !== id) : [...saved, id];
    setSaved(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Favorites still work for this visit. */ }
  }
  const personalMatches = useListingEvidence(profileId, profile, undefined, !groupId && (profileId === "demo-preview" || group.isSuccess));
  const groupMatches = useQuery<ListingMatchesResponse>({
    queryKey: ["live-rank", groupId], enabled: Boolean(groupId),
    refetchInterval: groupId ? 15000 : false,
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/groups/rank", { signal });
      if (!response.ok) throw new Error("Could not load matches.");
      return response.json();
    },
  });
  const matches = groupId ? groupMatches : personalMatches;
  const ranked = useMemo(() => groupId ? matches.data?.matches ?? [] : reweightMatches(matches.data?.matches ?? [], weights), [groupId, matches.data, weights]);
  const pricedMatches = ranked.filter(home => home.rent !== null);
  const pricedSavedCount = pricedMatches.filter(home => savedIds.includes(home.id)).length;
  const homes = pricedMatches.filter(home =>
    (view !== "saved" || savedIds.includes(home.id)) &&
    (homeType === "All homes" || home.type === homeType) &&
    `${home.name} ${home.area} Ann Arbor`.toLowerCase().includes(query.trim().toLowerCase())
  );
  const allZero = !groupId && Object.values(weights).every(value => value === 0);

  async function savePriorities() {
    if (profileId === "demo-preview") { setPrioritiesOpen(false); return; }
    setPriorityError("");
    try {
      const response = await fetch(`/api/profiles/${profileId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(weights) });
      if (!response.ok) throw new Error("Could not save your priorities.");
      if (groupId) await queryClient.invalidateQueries({ queryKey: ["live-rank", groupId] });
      setPrioritiesOpen(false);
    } catch (error) { setPriorityError(error instanceof Error ? error.message : "Could not save priorities."); }
  }

  async function signOut() {
    setSigningOut(true);
    setAccountError("");
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST" });
      if (!response.ok) throw new Error();
      queryClient.clear();
      window.location.assign("/");
    } catch {
      setAccountError("Couldn’t sign out. Please try again.");
      setSigningOut(false);
    }
  }

  return <div className={`${surveyStyles.shell} ${styles.browser}`}>
    <header className={styles.header}>
      <UnstyledButton className={styles.brand} onClick={profileId === "demo-preview" ? onBack : () => setView("homes")}><Icon name="house" size={27} />Homework</UnstyledButton>
      <nav className={styles.tabs} aria-label="Browse listings">
        <UnstyledButton aria-current={view === "homes" ? "page" : undefined} onClick={() => setView("homes")}>Homes</UnstyledButton>
        <UnstyledButton aria-current={view === "saved" ? "page" : undefined} onClick={() => setView("saved")}>Saved{pricedSavedCount ? ` (${pricedSavedCount})` : ""}</UnstyledButton>
      </nav>
      {profileId === "demo-preview" ? <UnstyledButton className={styles.student} onClick={onBack} aria-label="Back to sign in"><span className={styles.avatar}>{profile.name.slice(0, 1).toUpperCase()}</span><span>{profile.name}</span></UnstyledButton> : <div className={styles.accountMenu}>
        <Menu position="bottom-end" offset={8} width={225} radius={6} shadow="sm" classNames={{ dropdown: surveyStyles.accountDropdown, item: surveyStyles.accountItem }}>
          <Menu.Target><UnstyledButton className={styles.student} aria-label="Account menu" disabled={signingOut}><span className={styles.avatar}>{profile.name.slice(0, 1).toUpperCase()}</span><span>{profile.name}</span></UnstyledButton></Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<Icon name="sliders" size={16} />} onClick={onBack}>Profile / preferences</Menu.Item>
            <Menu.Item leftSection={<Icon name="house" size={16} />} onClick={() => setGroupOpen(true)}>{group.isPending ? "Housing group" : groupId ? "Group settings" : "Start a group"}</Menu.Item>
            <Menu.Divider />
            <Menu.Item leftSection={<Icon name="logout" size={16} />} onClick={signOut}>Sign out</Menu.Item>
          </Menu.Dropdown>
        </Menu>
        {accountError && <p className={styles.accountError} role="alert">{accountError}</p>}
      </div>}
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
        <div><h1>{view === "saved" ? groupId ? "Your group's saved homes" : "Your saved homes" : groupId ? `${group.data?.group?.name} matches` : "Your best matches in Ann Arbor"}</h1><p>{matches.isPending ? "Finding homes and checking your priorities…" : `${homes.length} ${homes.length === 1 ? "home" : "homes"}`}<span>{allZero ? ' · Set priorities to rank' : ' · Best match first'}</span></p></div>
        <UnstyledButton className={styles.prioritiesButton} onClick={() => setPrioritiesOpen(true)}><Icon name="sliders" size={18} />Your priorities</UnstyledButton>
      </div>
      <p className={styles.demoNote}>Live listings · {matches.data ? pricedMatches.length : "…"} matching homes with listed rent</p>
      {matches.data && <details className={styles.matchingNotes}><summary>What’s included in your match?</summary>{matches.data.notices.map(notice => <p key={notice}>{notice}</p>)}</details>}
      {matches.data?.matches.some(home => home.destinations.some(place => place.status === 'ok')) && <p className={styles.demoNote}>Walking estimates: Google Maps · May not include all sidewalks or pedestrian paths. Building access and weather can change your trip.</p>}
      <div aria-live="polite" className={styles.loadingStatus}>{matches.isFetching && !matches.isPending ? "Updating your matches…" : ""}</div>
      {(group.isError || groupSaves.isError) && <p role="alert">Could not load your group. <button onClick={() => { group.refetch(); groupSaves.refetch(); }}>Try again</button></p>}
      {savedError && <p role="alert">{savedError}</p>}
      {matches.isPending ? <div className={styles.empty}>Finding homes that fit your priorities…</div>
        : matches.isError ? <div className={styles.empty} role="alert"><h2>We couldn’t load your matches.</h2><button onClick={() => matches.refetch()}>Try again</button></div>
        : allZero ? <div className={styles.empty}><h2>Choose what matters to you.</h2><p>Give at least one priority a value above zero.</p><button onClick={() => setPrioritiesOpen(true)}>Adjust priorities</button></div>
        : !homes.length ? <div className={styles.empty}><h2>{allZero ? "Choose what matters to you." : view === "saved" && !pricedSavedCount ? "No saved homes with listed rent." : "No homes match this search."}</h2><p>{allZero ? "Give at least one priority a value above zero." : view === "saved" && !pricedSavedCount ? "Save a home with listed rent to see it here." : "Try another search, or review your budget and bedroom needs."}</p><button onClick={() => {
          if (allZero) setPrioritiesOpen(true);
          else { setQuery(""); setHomeType("All homes"); setView("homes"); }
        }}>{allZero ? "Adjust priorities" : "Browse all homes"}</button></div>
        : <div className={styles.grid}>{homes.map(home => {
          const favorite = savedIds.includes(home.id);
          return <article key={home.id} className={styles.card}>
            <div className={styles.imageWrap}>
              <Link className={styles.openPhoto} aria-label={`View ${home.name}`} href={`/listings/${home.id}?profile=${encodeURIComponent(profileId)}`}><ListingPhoto home={home} /></Link>
              <span className={styles.matchBadge}>{home.score === null ? "Unscored" : !groupId && locationIncomplete(home, weights) ? `${home.score} · Partial score` : `${home.score}% match`}</span>
              <UnstyledButton className={styles.favorite} data-saved={favorite} aria-label={`${favorite ? "Unsave" : "Save"} ${home.name}`} aria-pressed={favorite} disabled={Boolean(groupId && (groupSaves.isPending || groupSaves.isError))} onClick={() => toggleSaved(home.id)}><Icon name="heart" size={23} /></UnstyledButton>
            </div>
            <Link className={styles.cardTitle} href={`/listings/${home.id}?profile=${encodeURIComponent(profileId)}`}>{home.name}</Link>
            <p>{home.area} · {home.beds === null ? "Bedrooms unconfirmed" : `${home.beds} bedrooms`}</p>
            {!groupId && <p className={styles.verification}>{walkingSummary(home, profile.walk)}</p>}
            {home.scoreCoverage && <p>{home.scoreCoverage.scored} of {home.scoreCoverage.total} member profiles scored</p>}
            <p className={styles.price}><strong>{rentText(home)}</strong>{rentBasisText(home)}</p>
          </article>;
        })}</div>}
    </main>
    <Modal opened={prioritiesOpen} onClose={() => setPrioritiesOpen(false)} title="What matters most to you?" size={740} centered radius={20} closeButtonProps={{ "aria-label": "Close priorities" }}>
      <div className={`${surveyStyles.shell} ${styles.modalBody}`}><div className={styles.demoNote}>{matches.data?.notices.map(notice => <p key={notice}>{notice}</p>)}</div><PrioritySliders weights={weights} onChange={setWeights} />{priorityError && <p role="alert">{priorityError}</p>}<button className={styles.doneButton} onClick={savePriorities}>Done</button></div>
    </Modal>
    <GroupDialog opened={groupOpen} onClose={() => setGroupOpen(false)} />
  </div>;
}
