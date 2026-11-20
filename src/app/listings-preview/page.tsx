import { ListingsPreview } from "@/components/onboarding/ListingsPreview";
import { currentStudent } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";

export default async function Page() {
  if (!await currentStudent()) redirect("/");
  return <ListingsPreview />;
}
