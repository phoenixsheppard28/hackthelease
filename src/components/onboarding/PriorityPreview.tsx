"use client";

import Link from "next/link";
import { useState } from "react";
import { defaultWeights } from "@/lib/contracts/matching-weights";
import { PrioritySliders } from "./PrioritySliders";
import styles from "./Onboarding.module.scss";

export function PriorityPreview() {
  const [weights, setWeights] = useState({ ...defaultWeights });
  return <div className={styles.shell}>
    <header className={styles.header}>
      <Link href="/?home=1" className={`${styles.brand} ${styles.previewBrand}`}>HomeWork</Link>
      <span className={styles.previewCaption}>Your priorities</span>
    </header>
    <main className={`${styles.panel} ${styles.priorityPanel}`}>
      <div className={styles.content}>
        <h1 className={styles.question}>What matters <strong>most to you?</strong></h1>
        <p className={styles.description}>Adjust all four preferences to find your balance.</p>
        <PrioritySliders weights={weights} onChange={setWeights} />
        <p className={styles.previewNote}>Preview only · Your saved profile stays unchanged.</p>
      </div>
    </main>
  </div>;
}
