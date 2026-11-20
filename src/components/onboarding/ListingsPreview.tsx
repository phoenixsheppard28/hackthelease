"use client";

import { useRouter } from "next/navigation";
import { previewProfile } from "@/lib/matching/preview-profile";
import { Results } from "./Results";


export function ListingsPreview() {
  const router = useRouter();
  return <Results profile={previewProfile} profileId="demo-preview" onBack={() => router.push("/")} />;
}
