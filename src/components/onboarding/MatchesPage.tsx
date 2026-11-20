"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { savedProfileSchema, type HousingProfile } from "@/lib/contracts/housing-profile";
import { browseContextSchema, matchesHref, readBrowseContext, saveBrowseContext } from "@/lib/matching/browse-context";
import { previewProfile } from "@/lib/matching/preview-profile";
import { Results } from "./Results";
import { ListingDetail } from "./ListingDetail";

export function MatchesEntry({ profile, profileId }: { profile: HousingProfile; profileId: string }) {
  const router = useRouter();
  useEffect(() => {
    saveBrowseContext(profileId, browseContextSchema.parse({ profile, weights: profile.weights }));
    router.replace(matchesHref(profileId));
  }, [profile, profileId, router]);
  return <p role="status">Opening your matches…</p>;
}

export function MatchesPage({ profileId, listingId, groupOpen = false }: { profileId: string; listingId?: string; groupOpen?: boolean }) {
  const router = useRouter();
  const context = useQuery({
    queryKey: ["browse-context", profileId, listingId ?? "matches"],
    staleTime: 0,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const stored = readBrowseContext(profileId);
      if (profileId === "demo-preview") return browseContextSchema.parse({ profile: previewProfile, weights: previewProfile.weights });
      if (!profileId) throw new Error("Choose a student to see personalized matches.");
      const response = await fetch("/api/profiles", { signal });
      if (!response.ok) throw new Error("Could not load this student. Please try again.");
      const profiles = savedProfileSchema.array().parse(await response.json());
      const saved = profiles.find(item => item.id === profileId);
      if (!saved) throw new Error("Choose a student to see personalized matches.");
      return browseContextSchema.parse({ ...stored, profile: saved.profile, weights: saved.profile.weights });
    },
  });
  if (context.isPending) return <p role="status" style={{ padding: 32 }}>Loading your {listingId ? "home" : "matches"}…</p>;
  if (context.isError) return <main style={{ padding: 32 }}><p role="alert">{context.error.message}</p><Link href="/?edit=1">Edit your profile</Link></main>;
  return listingId
    ? <ListingDetail listingId={listingId} profileId={profileId} context={context.data} />
    : <Results profile={context.data.profile} profileId={profileId} initialBrowse={context.data} initialGroupOpen={groupOpen} onBack={() => router.push("/?edit=1")} />;
}
