import { z } from "zod";
import { currentStudent } from "@/lib/supabase/auth";
import { updateProfile, updateProfileWeights } from "@/lib/supabase/profiles";
import { housingProfileSchema } from "@/lib/contracts/housing-profile";
import { weightsSchema } from "@/lib/contracts/matching-weights";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const student = await currentStudent();
  if (!student) return Response.json({ error: "Sign in to update priorities." }, { status: 401 });
  const { id } = await context.params;
  const parsedId = z.uuid().safeParse(id);
  const text = await request.text();
  if (text.length > 65536) return Response.json({ error: "Profile is too large." }, { status: 413 });
  const body = (() => { try { return JSON.parse(text); } catch { return null; } })();
  const profile = housingProfileSchema.safeParse(body);
  const weights = weightsSchema.safeParse(body);
  if (!parsedId.success || (!profile.success && (!weights.success || Object.values(weights.data).every(value => value === 0)))) return Response.json({ error: "Invalid profile answers." }, { status: 400 });

  try { return Response.json(profile.success ? await updateProfile(student.id, id, profile.data) : await updateProfileWeights(student.id, id, weights.data!)); }
  catch { return Response.json({ error: "Could not save your profile." }, { status: 503 }); }
}
