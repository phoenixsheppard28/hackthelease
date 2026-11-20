import { beforeEach, expect, it, vi } from "vitest";
import HomePage from "./page";
import { currentStudent } from "@/lib/supabase/auth";
import { profilesRequest } from "@/lib/supabase/profiles";
import { redirect } from "next/navigation";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/auth", () => ({ currentStudent: vi.fn() }));
vi.mock("@/lib/supabase/profiles", () => ({ profilesRequest: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }) }));
vi.mock("@/components/onboarding/Onboarding", () => ({ Onboarding: () => null }));
vi.mock("@/components/onboarding/SignIn", () => ({ SignIn: () => null }));

const saved = { id: "profile-1", profile: { name: "Phoenix" } };

beforeEach(() => {
  vi.mocked(currentStudent).mockReset().mockResolvedValue({ id: "student-1", email: "student@example.com" });
  vi.mocked(profilesRequest).mockReset().mockResolvedValue([saved] as never);
  vi.mocked(redirect).mockClear();
});

it("opens matches for a returning student", async () => {
  await expect(HomePage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT");

  expect(redirect).toHaveBeenCalledWith("/matches?profile=profile-1");
});

it("opens profile editing when requested", async () => {
  const page = await HomePage({ searchParams: Promise.resolve({ edit: "1" }) });

  expect(redirect).not.toHaveBeenCalled();
  expect(page.props.initialProfile).toEqual(saved);
});

it("opens Calendar review for a returning student after connection", async () => {
  const page = await HomePage({ searchParams: Promise.resolve({ calendar: "review" }) });

  expect(redirect).not.toHaveBeenCalled();
  expect(page.props.initialCalendarReview).toBe(true);
});

it("opens group settings over matches for a returning student", async () => {
  await expect(HomePage({ searchParams: Promise.resolve({ group: "1" }) })).rejects.toThrow("NEXT_REDIRECT");

  expect(redirect).toHaveBeenCalledWith("/matches?profile=profile-1&group=1");
});

it("opens onboarding for a student without a profile", async () => {
  vi.mocked(profilesRequest).mockResolvedValue([]);

  const page = await HomePage({ searchParams: Promise.resolve({}) });

  expect(redirect).not.toHaveBeenCalled();
  expect(page.props.initialProfile).toBeUndefined();
});

it("does not offer a new profile when saved profiles cannot load", async () => {
  vi.mocked(profilesRequest).mockRejectedValue(new Error("storage unavailable"));

  await expect(HomePage({ searchParams: Promise.resolve({}) })).rejects.toThrow("storage unavailable");
  expect(redirect).not.toHaveBeenCalled();
});
