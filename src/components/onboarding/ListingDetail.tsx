"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { matchesHref, type BrowseContext } from "@/lib/matching/browse-context";
import { formatMoney, rentText, rentBasisText, type ListingMatchesResponse } from "@/lib/contracts/listing-match";
import { Icon } from "./Icon";
import { TravelTimes } from "./TravelTimes";
import styles from "./ListingDetail.module.scss";

export function ListingDetail({ listingId, profileId, context }: { listingId: string; profileId: string; context: BrowseContext }) {
  const { profile, weights } = context;
  const listing = useQuery<ListingMatchesResponse>({
    queryKey: ["live-listing", listingId, profile, weights],
    retry: 1,
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/matches", { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile, weights, listingId }) });
      if (!response.ok) throw new Error(response.status === 404 ? "This listing is no longer available." : "Could not load this home. Please try again.");
      return response.json();
    },
  });
  const home = listing.data?.matches[0];
  const [saved, setSaved] = useState(false);
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
  function toggleSaved() {
    const ids = readSaved();
    const next = saved ? ids.filter(id => id !== listingId) : [...new Set([...ids, listingId])];
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep the action usable for this visit. */ }
    setSaved(!saved);
  }
  const back = matchesHref(profileId);
  if (listing.isPending) return <main className={styles.unavailable}><p role="status">Loading this home…</p><Link href={back}>Back to matches</Link></main>;
  if (listing.isError || !home) return <main className={styles.unavailable}><p role="alert">{listing.error?.message || "This listing is unavailable."}</p><button onClick={() => listing.refetch()}>Try again</button> <Link href={back}>Back to matches</Link></main>;
  const budget = profile.basis === "Just me" ? profile.budget : profile.budget / (profile.roommates + 1);
  const difference = home.perPersonRent ? budget - home.perPersonRent.max : null;
  const supported = home.components.filter(component => component.score !== null && component.weight > 0).sort((a, b) => b.weight - a.weight);
  const roomsNeeded = Math.ceil((profile.roommates + 1) / profile.occupancy);
  const photo = home.images[photoIndex] ?? home.image;
  const phone = home.contact?.phone?.replace(/[^+\d]/g, "");
  const email = home.contact?.email;
  const sourceName = home.sourceUrl ? new URL(home.sourceUrl).hostname.replace(/^www\./, "") : null;
  const date = new Date(home.sourceFetchedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return <div className={styles.page}>
    <header className={styles.header}>
      <Link href={back} className={styles.brand}>Hack the Lease</Link>
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
          <section className={styles.places}><h2>Your places, from here</h2><div className={styles.placeGrid}>{home.destinations.map(place => <div key={place.name}><p>{place.name}</p><small>{profile.walk[place.name] !== undefined ? `Your limit: ${profile.walk[place.name]} min` : "No walking limit"}</small></div>)}</div><p className={styles.footnote}>These walking limits are not included in the match score yet.</p><TravelTimes key={home.id} origin={home.address} /></section>
        </section>
        <section className={styles.details} aria-label="Home details">
          <div className={styles.location}><span><Icon name="house" size={19} /></span>{home.area}</div>
          <div className={styles.title}><div><h1>{home.name}</h1><p><strong>{home.score === null ? "Match not scored" : `${home.score}% match`}</strong> <span>for {profile.name}</span></p></div><button className={styles.save} aria-label={`${saved ? "Unsave" : "Save"} ${home.name}`} aria-pressed={saved} onClick={toggleSaved}><Icon name="heart" size={21} /></button></div>
          <div className={styles.rent}>{rentText(home)}<span>{rentBasisText(home)}</span></div>
          <p className={styles.budget}>{difference === null ? "Rent or rent basis needs verification." : difference === 0 ? "At your rent limit, before additional fees." : `${formatMoney(Math.abs(difference))} ${difference > 0 ? "below" : "above"} your per-person rent limit, before additional fees.`}</p>
          {home.rentBasis === "per_unit" && home.perPersonRent && <p className={styles.footnote}>Estimated share: {formatMoney(home.perPersonRent.min)}{home.perPersonRent.max !== home.perPersonRent.min ? `–${formatMoney(home.perPersonRent.max)}` : ""} / person, split equally across {profile.roommates + 1}. Confirm permitted occupancy and fees.</p>}
          <dl className={styles.facts}><div><dt>Bedrooms</dt><dd>{home.beds ?? "Needs verification"}</dd></div><div><dt>Your group</dt><dd>{profile.roommates ? `You + ${profile.roommates} roommate${profile.roommates === 1 ? "" : "s"}` : "Just you"}</dd></div><div><dt>Available from</dt><dd>{home.availableFrom ?? "Needs verification"}</dd></div></dl>
          <div className={styles.actions}>
            <button className={styles.primary} disabled aria-describedby="simulation-status">Simulate a typical day</button>
            <p id="simulation-status" className={styles.footnote}>Day simulation isn’t connected yet.</p>
            {email ? <a className={styles.secondary} href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Inquiry about ${home.name}`)}`}>Email landlord</a> : <button className={styles.secondary} disabled>Email unavailable</button>}
            {phone && /\d{7,}/.test(phone) ? <a className={styles.secondary} href={`tel:${phone}`}>Call landlord</a> : <button className={styles.secondary} disabled>Phone unavailable</button>}
            <p className={styles.footnote}>{home.contact?.name || sourceName || "Listing contact"}{home.contact?.phone ? ` · ${home.contact.phone}` : ""}</p>
          </div>
          <section className={styles.description}><h2>Picked around your priorities</h2><p>{supported.length ? `Your score currently uses ${supported.map(component => component.label.toLowerCase()).join(" and ")}, weighted by your sliders.` : "Your selected priorities cannot be scored with the available data yet."} {home.beds === null ? "The bedroom count needs verification." : home.beds >= roomsNeeded ? `The listed ${home.beds} bedrooms meet your group’s need for ${roomsNeeded}.` : `Your group needs ${roomsNeeded} bedrooms; this listing has ${home.beds}.`}</p><p>Location is awaiting travel estimates. {home.components.find(component => component.label === "Lifestyle")?.score === null && "Semantic lifestyle matching is unavailable."}</p></section>
          {home.sourceUrl ? <a className={styles.source} href={home.sourceUrl} target="_blank" rel="noreferrer">View original posting <span>↗</span></a> : <button className={styles.source} disabled>Original posting unavailable</button>}
          <p className={styles.footnote}>{sourceName} · Last checked {date}</p>
          <details className={styles.breakdown}><summary>Why it ranks here</summary><dl>{home.components.map(component => <div key={component.label}><dt>{component.label}<small>Importance {component.weight}/100</small></dt><dd>{component.score === null ? "Not scored" : `${component.score}/100`}</dd></div>)}</dl><p className={styles.footnote}>Available category scores are weighted by your sliders. Unknown budget or bedroom evidence receives a neutral score. Location and unavailable lifestyle scores are excluded.</p></details>
          <details className={styles.breakdown}><summary>Needs verification ({home.verificationFlags.length})</summary><ul>{home.verificationFlags.map(flag => <li key={flag}>{flag}</li>)}</ul></details>
          {home.description && <section className={styles.description}><h2>About this home</h2><p>{home.description}</p></section>}
          {home.features.length > 0 && <details className={styles.breakdown}><summary>Features from the listing</summary><ul>{home.features.map(feature => <li key={feature}>{feature}</li>)}</ul></details>}
        </section>
      </div>
    </main>
  </div>;
}
