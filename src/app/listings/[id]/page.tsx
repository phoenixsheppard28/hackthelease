import { notFound } from "next/navigation";
import { MatchesPage } from "@/components/onboarding/MatchesPage";
import { z } from "zod";

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ profile?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { profile } = await searchParams;
  return <MatchesPage listingId={id} profileId={typeof profile === "string" ? profile : ""} />;
}
