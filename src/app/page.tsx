import { Onboarding } from "@/components/onboarding/Onboarding";
import { SignIn } from "@/components/onboarding/SignIn";
import { currentStudent } from "@/lib/supabase/auth";
import { profilesRequest } from "@/lib/supabase/profiles";
import { matchesHref } from "@/lib/matching/browse-context";
import { redirect } from "next/navigation";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ authError?: string; edit?: string; group?: string }> }) {
  const student = await currentStudent();
  if (!student) return <SignIn error={(await searchParams).authError === "google"} />;

  const [params, profiles] = await Promise.all([searchParams, profilesRequest(student.id)]);
  const profile = profiles[0];
  if (profile && params.edit !== "1") redirect(matchesHref(profile.id) + (params.group === "1" ? "&group=1" : ""));

  return <Onboarding initialProfile={profile} initialGroupOpen={params.group === "1"} />;
}
