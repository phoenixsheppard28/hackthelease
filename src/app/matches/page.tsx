import { MatchesPage } from "@/components/onboarding/MatchesPage";

export default async function Page({ searchParams }: { searchParams: Promise<{ profile?: string; group?: string }> }) {
  const { profile, group } = await searchParams;
  return <MatchesPage profileId={typeof profile === "string" ? profile : ""} groupOpen={group === "1"} />;
}
