import { Onboarding } from "@/components/onboarding/Onboarding";
import { SignIn } from "@/components/onboarding/SignIn";
import { currentStudent } from "@/lib/supabase/auth";

export default async function HomePage() {
  return await currentStudent() ? <Onboarding /> : <SignIn />;
}
