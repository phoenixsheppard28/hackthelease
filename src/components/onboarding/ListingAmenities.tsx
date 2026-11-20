"use client";

import { useState } from 'react';
import styles from './ListingAmenities.module.scss';

// Match only the icon/category; never rewrite whether an amenity is included,
// allowed, unavailable, or paid for by the resident.
const categories = [
  { pattern: /\bparking\b/i, path: 'm5 10 2-5h10l2 5M4 10h16v9H4zM7 14h.01M17 14h.01M6 19v2M18 19v2' },
  { pattern: /\bgarage\b/i, path: 'M3 21V8l9-5 9 5v13M6 21V10h12v11M6 14h12M6 18h12' },
  { pattern: /\b(laundry|washer|dryer|washing)\b/i, path: 'M4 3h16v18H4zM4 7h16M7 5h.01M10 5h.01M12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8M8 14c3-3 5 3 8 0' },
  { pattern: /\b(cats?|feline)\b/i, path: 'M5 10V3l5 4h4l5-4v7a8 8 0 1 1-14 0ZM9 12h.01M15 12h.01m-4 3 1 1 1-1M2 14l5 1M17 15l5-1' },
  { pattern: /\b(pets?|dogs?)\b/i, path: 'M8 14c-5 2-4 7 0 7l4-1 4 1c4 0 5-5 0-7l-4-3ZM5 7a2 3 0 1 0 0 .01M10 4a2 3 0 1 0 0 .01M15 4a2 3 0 1 0 0 .01M20 7a2 3 0 1 0 0 .01' },
  { pattern: /\b(utilit(?:y|ies)|electric(?:ity)?|gas|heat(?:ing)?)\b/i, path: 'm13 2-9 12h7l-1 8 10-12h-7z' },
  { pattern: /\bwater\b/i, path: 'M12 3S5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12ZM8 15a4 4 0 0 0 4 4' },
  { pattern: /\b(trash|garbage|recycling)\b/i, path: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7' },
  { pattern: /\b(wifi|wi-fi|internet)\b/i, path: 'M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0M12 20h.01' },
  { pattern: /\b(air conditioning|air conditioned|a\/c|ac)\b/i, path: 'M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M3 10l4-1-1-4M18 19l-1-4 4-1M3 14l4 1-1 4M18 5l-1 4 4 1' },
  { pattern: /\b(kitchen|oven|range|stove|dishwasher)\b/i, path: 'M4 3h16v18H4zM4 8h16M7 5h.01M11 5h.01M16 5h.01M7 11h10v7H7z' },
  { pattern: /\b(refrigerator|fridge)\b/i, path: 'M5 3h14v18H5zM5 10h14M8 6v1M8 13v3' },
  { pattern: /\b(furnished|unfurnished)\b/i, path: 'M5 12V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5M5 16h14M3 12h3v7h12v-7h3v9H3z' },
  { pattern: /\b(accessible|elevator|step.free)\b/i, path: 'M12 3a2 2 0 1 0 0 .01M12 7v7h5l3 6M12 10h5M9 11a5 5 0 1 0 6 8' },
  { pattern: /\b(yard|garden|patio|balcony)\b/i, path: 'M12 21V11M12 16C3 17 3 9 3 9s9-1 9 7ZM12 12c9 1 9-7 9-7s-9-1-9 7Z' },
];

export function listingAmenities(features: string[]) {
  const unique = new Map<string, string>();
  for (const feature of features) {
    const label = feature.trim().replace(/\s+/g, ' ');
    if (label) unique.set(label.toLowerCase(), label.charAt(0).toUpperCase() + label.slice(1));
  }
  return [...unique.values()].map(label => {
    const category = categories.findIndex(({ pattern }) => pattern.test(label));
    return { label, priority: category < 0 ? categories.length : category,
      path: categories[category]?.path ?? 'm12 3 9 9-9 9-9-9z' };
  }).sort((a, b) => a.priority - b.priority);
}

export function ListingAmenities({ features }: { features: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const amenities = listingAmenities(features);
  if (!amenities.length) return null;
  return <section className={styles.amenities} aria-label="What this place offers">
    <h2>What this place offers</h2>
    <ul>{(expanded ? amenities : amenities.slice(0, 10)).map(({ label, path }) => <li key={label}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d={path} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span>{label}</span>
    </li>)}</ul>
    {amenities.length > 10 && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Show fewer features' : `Show all ${amenities.length} features`}</button>}
  </section>;
}
