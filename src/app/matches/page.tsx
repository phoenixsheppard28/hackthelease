import { MatchesPage } from "@/components/onboarding/MatchesPage";

export default async function Page({ searchParams }: { searchParams: Promise<{ profile?: string }> }) {
  const { profile } = await searchParams;
  return <MatchesPage profileId={typeof profile === "string" ? profile : ""} />;
}
