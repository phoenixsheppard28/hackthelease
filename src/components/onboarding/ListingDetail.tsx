"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { matchesHref, type BrowseContext } from "@/lib/matching/browse-context";
import { formatMoney, rentText, rentBasisText, type ListingMatchesResponse } from "@/lib/contracts/listing-match";
import { requiredBedrooms } from '@/lib/contracts/housing-profile';
import { locationIncomplete, reweightMatches } from '@/lib/matching/location-score';
import { walkingStatusText } from '@/lib/travel/types';
import { useListingEvidence } from './useListingEvidence';
import { Icon } from "./Icon";
import { TravelTimes } from "./TravelTimes";
import { ListingAmenities } from './ListingAmenities';
import styles from "./ListingDetail.module.scss";

export function ListingDetail({ listingId, profileId, context }: { listingId: string; profileId: string; context: BrowseContext }) {
  const { profile, weights } = context;
  const queryClient = useQueryClient();
  const group = useQuery<{ group: { id: string; name: string; members: { id: string }[] } | null }>({
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
  // Personal destinations belong to the viewing student, including in group mode.
  // This query is separate from the polling group score and reuses route evidence.
  const personalListing = useListingEvidence(profileId, profile, listingId, profileId === "demo-preview" || group.isSuccess);
  const groupListing = useQuery<ListingMatchesResponse>({
    queryKey: ["live-listing", listingId, groupId], enabled: Boolean(groupId),
    refetchInterval: groupId ? 15000 : false,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/groups/rank?listingId=${encodeURIComponent(listingId)}`, { signal });
      if (!response.ok) throw new Error(response.status === 404 ? "This listing is no longer available." : "Could not load this home. Please try again.");
      return response.json();
    },
  });
  const listing = groupId ? groupListing : personalListing;
  const home = groupId ? listing.data?.matches[0] : reweightMatches(listing.data?.matches ?? [], weights)[0];
  const personalDestinations = personalListing.data?.matches.find(item => item.id === listingId)?.destinations ?? [];
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [failedPhoto, setFailedPhoto] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const storageKey = `hackthelease:saved:${profileId || profile.name}`;
  function readSaved(): string[] {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
    } catch { return []; }
  }
  useEffect(() => {
    const sync = () => setSaved(readSaved().includes(listingId));
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [storageKey, listingId]);
  const isSaved = groupId ? Boolean(groupSaves.data?.ids.includes(listingId)) : saved;
  async function toggleSaved() {
    if (groupId) {
      setSaveError("");
      try {
        const response = await fetch("/api/groups/saves", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId, saved: !isSaved }) });
        if (!response.ok) throw new Error("Could not update the group's saved homes.");
        await queryClient.invalidateQueries({ queryKey: ["group-saves", groupId] });
      } catch (error) { setSaveError(error instanceof Error ? error.message : "Could not save this home."); }
      return;
    }

    const ids = readSaved();
    const next = saved ? ids.filter(id => id !== listingId) : [...new Set([...ids, listingId])];
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep the action usable for this visit. */ }
    setSaved(!saved);
  }
  const back = matchesHref(profileId);
  if (group.isError) return <main className={styles.unavailable}><p role="alert">Could not load your housing group.</p><button onClick={() => group.refetch()}>Try again</button></main>;
  if (listing.isPending) return <main className={styles.unavailable}><p role="status">Loading this home…</p><Link href={back}>Back to matches</Link></main>;
  if (listing.isError || !home || home.rent === null) return <main className={styles.unavailable}><p role="alert">{listing.error?.message || "This listing is unavailable."}</p><button onClick={() => listing.refetch()}>Try again</button> <Link href={back}>Back to matches</Link></main>;
  const householdCount = groupId ? group.data?.group?.members.length ?? profile.roommates + 1 : profile.roommates + 1;
  const budget = profile.basis === "Just me" ? profile.budget : profile.budget / householdCount;
  const difference = home.perPersonRent ? budget - home.perPersonRent.max : null;
  const supported = home.components.filter(component => component.score !== null && component.weight > 0).sort((a, b) => b.weight - a.weight);
  const roomsNeeded = Math.max(profile.bedrooms ?? 0, requiredBedrooms({ ...profile, bedrooms: undefined, roommates: householdCount - 1 }));
  const photo = home.images[photoIndex] ?? home.image;
  const phone = home.contact?.phone?.replace(/[^+\d]/g, "");
  const email = home.contact?.email;
  const sourceName = home.sourceUrl ? new URL(home.sourceUrl).hostname.replace(/^www\./, "") : null;
  const date = new Date(home.sourceFetchedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return <div className={styles.page}>
    <header className={styles.header}>
      <Link href={back} className={styles.brand}>HomeWork</Link>
      <Link href={back} className={styles.search}><Icon name="search" size={19} />Search Ann Arbor homes</Link>
      <Link href="/" className={styles.student} aria-label={`Switch student, currently ${profile.name}`}><span className={styles.avatar}>{profile.name.slice(0, 1).toUpperCase()}</span><span>{profile.name}</span></Link>
    </header>
    <main className={styles.main}>
      <div className={styles.topline}><Link href={back}>← Back to matches</Link><span>Last checked {date}</span></div>
      <div className={styles.grid}>
        <section className={styles.visual} aria-label="Listing photo and nearby places">
          <div className={styles.gallery}>
            <div className={styles.photo}>
              {failedPhoto || !photo ? <div className={styles.fallback}><Icon name="house" size={32} />Photo unavailable</div> : <Image key={photo} src={photo} alt={`Property photo ${photoIndex + 1} of ${home.name}`} fill priority sizes="(max-width: 680px) 100vw, 40vw" onError={() => setFailedPhoto(true)} />}
              {photo && <span className={styles.credit}>Listing photo · {photoIndex + 1} of {home.images.length}</span>}
            </div>
            {home.images.length > 1 && <div className={styles.photoPicker} aria-label="Property photos">{home.images.map((image, index) => <button key={image} aria-label={`Show photo ${index + 1}`} aria-pressed={index === photoIndex} onClick={() => { setPhotoIndex(index); setFailedPhoto(false); }}><Image src={image} alt="" width={56} height={56} /></button>)}</div>}
          </div>
          <ListingAmenities key={home.id} features={home.features} />
          <section className={styles.places}><h2>Your places, from here</h2>
            {groupId && <p className={styles.footnote}>Walking times to the three places in your profile.</p>}
            <div className={styles.placeGrid} aria-busy={personalListing.isPending}>{profile.hubs.map(name => {
              const place = personalDestinations.find(item => item.name === name);
              const limit = profile.walk[name];
              const available = place?.status === 'ok' && place.minutes !== null;
              return <div key={name}><p>{name}</p>
                <strong>{available ? `${place.minutes} min` : personalListing.isPending ? 'Checking…' : 'Not available'}</strong>
                <p>{available ? `walk${place.distanceMeters !== null ? ` · ${(place.distanceMeters / 1000).toFixed(1)} km` : ''}` : personalListing.isPending ? 'Finding a walking route' : walkingStatusText(place?.status ?? 'unavailable')}</p>
                <small>{limit === undefined ? 'No walking limit set' : !available ? `Your preference: ${limit} min` : place.minutes! <= limit ? `Within your ${limit} min preference` : `${place.minutes! - limit} min over your ${limit} min preference`}</small>
              </div>;
            })}</div>
            {personalListing.isError && <p role="alert">Couldn’t load walking times. <button onClick={() => personalListing.refetch()}>Retry walking times</button></p>}
            <p className={styles.footnote}>Walking estimates: Google Maps. Routes may not include all sidewalks or pedestrian paths. Times are to the building; allow extra time for entry, weather, and accessibility needs.</p>
            <TravelTimes key={home.id} origin={home.address} />
          </section>
        </section>
        <section className={styles.details} aria-label="Home details">
          <div className={styles.location}><span><Icon name="house" size={19} /></span>{home.area}</div>
          <div className={styles.title}><div><h1>{home.name}</h1><p><strong>{home.score === null ? "Match not scored" : !groupId && locationIncomplete(home, weights) ? `${home.score} · Partial score` : `${home.score}% match`}</strong> <span>for {groupId ? group.data?.group?.name : profile.name}</span></p>{home.scoreCoverage && <p>{home.scoreCoverage.scored} of {home.scoreCoverage.total} member profiles scored</p>}</div><button className={styles.save} aria-label={`${isSaved ? "Unsave" : "Save"} ${home.name}`} aria-pressed={isSaved} disabled={Boolean(groupId && (groupSaves.isPending || groupSaves.isError))} onClick={toggleSaved}><Icon name="heart" size={21} /></button></div>
          {(saveError || groupSaves.isError) && <p role="alert">{saveError || "Could not load the group's saved homes."}</p>}
          <div className={styles.rent}>{rentText(home)}<span>{rentBasisText(home)}</span></div>
          <p className={styles.budget}>{difference === null ? "Rent comparison unavailable." : difference === 0 ? "At your rent limit, before additional fees." : `${formatMoney(Math.abs(difference))} ${difference > 0 ? "below" : "above"} your per-person rent limit, before additional fees.`}</p>
          {home.rentBasis === "per_unit" && home.perPersonRent && <p className={styles.footnote}>Estimated share: {formatMoney(home.perPersonRent.min)}{home.perPersonRent.max !== home.perPersonRent.min ? `–${formatMoney(home.perPersonRent.max)}` : ""} / person, split equally across {householdCount}. Confirm permitted occupancy and fees.</p>}
          <dl className={styles.facts}><div><dt>Bedrooms</dt><dd>{home.beds ?? "Not listed"}</dd></div><div><dt>Your group</dt><dd>{householdCount > 1 ? `You + ${householdCount - 1} roommate${householdCount === 2 ? "" : "s"}` : "Just you"}</dd></div><div><dt>Available from</dt><dd>{home.availableFrom ?? "Not listed"}</dd></div></dl>
          <div className={styles.actions}>
            <button className={styles.primary} disabled aria-describedby="simulation-status">Simulate a typical day</button>
            <p id="simulation-status" className={styles.footnote}>Day simulation isn’t connected yet.</p>
            {email ? <a className={styles.secondary} href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Inquiry about ${home.name}`)}`}>Email landlord</a> : <button className={styles.secondary} disabled>Email unavailable</button>}
            {phone && /\d{7,}/.test(phone) ? <a className={styles.secondary} href={`tel:${phone}`}>Call landlord</a> : <button className={styles.secondary} disabled>Phone unavailable</button>}
            <p className={styles.footnote}>{home.contact?.name || sourceName || "Listing contact"}{home.contact?.phone ? ` · ${home.contact.phone}` : ""}</p>
          </div>
          <section className={styles.description}><h2>Picked around your priorities</h2><p>{groupId ? "The group score averages each member's match score. Confirmed budget or bedroom failures remove a home from the group shortlist." : supported.length ? `Your score currently uses ${supported.map(component => component.label.toLowerCase()).join(" and ")}, weighted by your sliders.` : "Your selected priorities cannot be scored with the available data yet."} {home.beds === null ? "The bedroom count isn’t listed." : home.beds >= roomsNeeded ? `The listed ${home.beds} bedrooms meet your group’s need for ${roomsNeeded}.` : `Your group needs ${roomsNeeded} bedrooms; this listing has ${home.beds}.`}</p><p>{groupId ? "Group location scoring is not connected yet." : home.components.find(component => component.label === "Location")?.score === null ? "Location needs complete walking estimates for your three destinations." : "Location measures walking convenience across your three destinations equally, with an extra penalty for exceeding a walking preference."} {!groupId && home.components.find(component => component.label === "Lifestyle")?.score === null && "Semantic lifestyle matching is unavailable."}</p></section>
          {home.sourceUrl ? <a className={styles.source} href={home.sourceUrl} target="_blank" rel="noreferrer">View original posting <span>↗</span></a> : <button className={styles.source} disabled>Original posting unavailable</button>}
          <p className={styles.footnote}>{sourceName} · Last checked {date}</p>
          {!groupId && <details className={styles.breakdown}><summary>Why it ranks here</summary><dl>{home.components.map(component => <div key={component.label}><dt>{component.label}<small>Importance {component.weight}/100</small></dt><dd>{component.score === null ? "Not scored" : `${component.score}/100`}</dd></div>)}</dl><p className={styles.footnote}>Available category scores are weighted by your sliders. Unknown budget or bedroom evidence receives a neutral score. Incomplete location and unavailable lifestyle scores are excluded. With Location above zero, homes with complete walking estimates rank ahead of those with incomplete estimates. Scores measure fit, not probability.</p></details>}
          {home.description && <section className={styles.description}><h2>About this home</h2><p>{home.description}</p></section>}
        </section>
      </div>
    </main>
  </div>;
}
