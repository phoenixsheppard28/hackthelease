import { Onboarding } from "@/components/onboarding/Onboarding";
import { SignIn } from "@/components/onboarding/SignIn";
import { currentStudent } from "@/lib/supabase/auth";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ authError?: string }> }) {
  return await currentStudent() ? <Onboarding /> : <SignIn error={(await searchParams).authError === "google"} />;
}
