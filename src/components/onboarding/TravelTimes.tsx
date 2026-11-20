"use client";

import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { TravelEstimates } from "@/lib/travel/estimate";
import styles from "./ListingDetail.module.scss";

type TravelResponse = { routes: TravelEstimates; attribution: string; walkingWarning: string };

export function TravelTimes({ origin }: { origin: string }) {
  const [destination, setDestination] = useState("");
  const estimate = useMutation({
    mutationFn: async (address: string): Promise<TravelResponse> => {
      const response = await fetch("/api/travel-times", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination: address }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Travel estimates are unavailable.");

      return result;
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    estimate.mutate(destination.trim());
  }

  return <div className={styles.travel}>
    <form onSubmit={submit}>
      <label htmlFor="travel-destination">Compare travel time from this home</label>
      <div><input id="travel-destination" type="text" value={destination} onChange={event => setDestination(event.target.value)} placeholder="Destination address in Ann Arbor" minLength={5} maxLength={200} required /><button type="submit" disabled={estimate.isPending}>{estimate.isPending ? "Checking…" : "Check routes"}</button></div>
    </form>
    {estimate.isError && <p role="alert">{estimate.error.message}</p>}
    {estimate.data && <div aria-live="polite">
      <dl>{(["walking", "driving", "bus"] as const).map(mode => <div key={mode}><dt>{mode === "bus" ? "Bus" : mode === "driving" ? "Drive" : "Walk"}</dt><dd>{estimate.data.routes[mode] ? `${estimate.data.routes[mode].durationMinutes} min` : "No route found"}</dd></div>)}</dl>
      <a href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(estimate.variables ?? destination)}`} target="_blank" rel="noopener noreferrer">View directions ↗</a>
      <p className={styles.footnote}>{estimate.data.attribution} · {estimate.data.walkingWarning}</p>
    </div>}
  </div>;
}
