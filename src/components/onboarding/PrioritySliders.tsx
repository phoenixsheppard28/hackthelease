"use client";

import { Slider, UnstyledButton } from "@mantine/core";
import { useId } from "react";
import { defaultWeights, type Weights } from "@/lib/contracts/matching-weights";
import styles from "./Onboarding.module.scss";

const categories = ["Location", "Budget", "Home fit", "Lifestyle"] as const;
const descriptions: Record<keyof Weights, string> = {
  Location: "Closeness to the places you visit most.",
  Budget: "How well the rent fits your budget.",
  "Home fit": "House or apartment, bedrooms, and roommates.",
  Lifestyle: "Dining, nightlife, and your interests.",
};

export function PrioritySliders({ weights, onChange, disabled = false }: {
  weights: Weights;
  onChange: (weights: Weights) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const isDefault = categories.every(key => weights[key] === defaultWeights[key]);

  return <section className={styles.priorities} aria-label="Matching priorities">
    <div className={styles.priorityRows}>
      {categories.map((key, index) => {
        const labelId = `${id}-${index}-label`;
        return <div className={styles.priorityRow} key={key}>
            <div className={styles.priorityLabel}>
              <h2 id={labelId} className={styles.priorityName}>{key}</h2>
              <p id={`${labelId}-description`} className={styles.priorityDescription}>{descriptions[key]}</p>
            </div>
            <Slider min={0} max={100} step={1} value={weights[key]} disabled={disabled}
              onChange={value => onChange({ ...weights, [key]: value })}
              label={null} size={9} radius={999} thumbSize={40}
              thumbLabel={`${key} importance`}
              thumbValueText={value => `${value} out of 100`}
              thumbProps={{ "aria-labelledby": labelId, "aria-describedby": `${labelId}-description` }}
              style={{ "--priority-fill": `${weights[key]}%` }}
              classNames={{ root: styles.volumeSlider, trackContainer: styles.volumeContainer,
                track: styles.volumeTrack, bar: styles.volumeFill, thumb: styles.volumeThumb }}
            />
            <output className={styles.priorityValue} aria-label={`${key} value`}>{weights[key]}</output>
        </div>;
      })}
    </div>
    <div className={styles.priorityScale} aria-hidden="true"><span>0 · Not important</span><span>100 · Very important</span></div>
    <div className={styles.priorityFooter}>
      <UnstyledButton className={styles.resetPriorities} disabled={disabled || isDefault} onClick={() => onChange({ ...defaultWeights })}>Reset to defaults</UnstyledButton>
    </div>
  </section>;
}
