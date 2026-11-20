"use client";

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { HousingProfile } from '@/lib/contracts/housing-profile';
import { listingEvidenceOptions } from '@/lib/matching/evidence-query';

export function useListingEvidence(profileId: string, profile: HousingProfile, listingId?: string) {
  const client = useQueryClient();
  return useQuery(listingEvidenceOptions(client, profileId, profile, listingId));
}
