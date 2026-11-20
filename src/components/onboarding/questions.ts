import { campusHubs, type ProfileDraft } from "@/lib/contracts/housing-profile";
import { defaultWeights } from "@/lib/contracts/matching-weights";

export type Question = {
  key: keyof ProfileDraft | "calendar";
  title: string;
  emphasis: string;
  kind: "text" | "number" | "choices" | "multiple" | "distances" | "calendar" | "textarea" | "priorities";
  options?: readonly string[];
  description?: string;
  min?: number;
  max?: number;
};

const questions: Question[] = [
  { key: "name", title: "What’s your name?", emphasis: "name", kind: "text" },
  { key: "calendar", title: "Connect your Google Calendar?", emphasis: "Google Calendar", kind: "calendar", description: "We use AI to suggest places from recurring event titles and locations. Review each place before it affects your matches." },
  { key: "budget", title: "What’s your monthly rent limit?", emphasis: "monthly rent limit", kind: "number", min: 1, max: 100000, description: "Enter your budget in US dollars." },
  { key: "basis", title: "Who does that budget cover?", emphasis: "budget", kind: "choices", options: ["Just me", "Our whole group"] },
  { key: "hubs", title: "Which three places do you visit most?", emphasis: "three places", kind: "multiple", options: campusHubs, description: "Choose three campus destinations." },
  { key: "walk", title: "How long would you walk to each place?", emphasis: "walk", kind: "distances", description: "Your maximum walk, in minutes. Leave any blank if you don’t have a limit." },
  { key: "roommates", title: "How many roommates will you have?", emphasis: "roommates", kind: "number", min: 0, max: 20, description: "Count everyone you’ll live with, apart from yourself." },
  { key: "type", title: "Where would you like to live?", emphasis: "live", kind: "choices", options: ["House", "Apartment", "Either"] },
  { key: "share", title: "Are you comfortable sharing a bedroom?", emphasis: "sharing a bedroom", kind: "choices", options: ["Yes", "No"] },
  { key: "occupancy", title: "How many people per bedroom, including you?", emphasis: "people per bedroom", kind: "number", min: 2, max: 21 },
  { key: "bedrooms", title: "What’s the minimum number of bedrooms you need?", emphasis: "bedrooms", kind: "number", min: 1, max: 21, description: "Count bedrooms for your whole home, including any extra rooms you want." },
  { key: "car", title: "Will you have a car?", emphasis: "car", kind: "choices", options: ["Yes", "No"] },
  { key: "bus", title: "How far would you walk to a bus stop?", emphasis: "bus stop", kind: "number", min: 1, max: 120, description: "Optional. Enter your maximum walk in minutes, or leave blank for no limit." },
  { key: "year", title: "What year are you?", emphasis: "year", kind: "choices", options: ["First year", "Sophomore", "Junior", "Senior", "Graduate", "Other"] },
  { key: "major", title: "What’s your major?", emphasis: "major", kind: "text" },
  { key: "night", title: "How often do you go out?", emphasis: "go out", kind: "choices", options: ["Often", "Sometimes", "Rarely"] },
  { key: "food", title: "Where do you usually eat?", emphasis: "eat", kind: "choices", options: ["Dining hall", "Cook at home", "A mix"] },
  { key: "group", title: "Who are you rooming with?", emphasis: "rooming with", kind: "choices", options: ["Already have a group", "Open to random roommates", "A mix"] },
  { key: "interests", title: "What else makes a place feel like home?", emphasis: "feel like home", kind: "textarea", description: "Pickup basketball at the IM? Late nights at the Fishbowl? Tell us what matters to you." },
  { key: "weights", title: "What matters most to you?", emphasis: "most to you?", kind: "priorities", description: "Adjust all four preferences to find your balance." },
];

export function visibleQuestions(profile: ProfileDraft) {
  return questions.filter(question => {
    if (question.key === "bus") return profile.car !== "Yes";
    if (question.key === "occupancy") return profile.share === "Yes" && (profile.roommates ?? 0) > 0;
    if (question.key === "share" || question.key === "group") return profile.roommates !== 0;
    return true;
  });
}

export function validateAnswer(question: Question, profile: ProfileDraft): string | null {
  if (question.kind === "calendar" || question.kind === "textarea") return null;
  if (question.kind === "priorities") {
    return Object.values(profile.weights ?? defaultWeights).some(value => value > 0)
      ? null : "Give at least one preference some importance.";
  }
  const value = profile[question.key as keyof ProfileDraft];
  if (question.kind === "distances") {
    return profile.hubs?.every(hub => {
      const minutes = profile.walk?.[hub];
      return minutes === undefined || (Number.isInteger(minutes) && minutes >= 1 && minutes <= 120);
    }) ? null : "Enter a whole number between 1 and 120, or leave the field blank.";
  }
  if (question.kind === "multiple") return profile.hubs?.length === 3 ? null : "Choose exactly three places.";
  if (question.kind === "number") {
    if (question.key === "bus" && value == null) return null;
    if (typeof value !== "number" || !Number.isInteger(value) || value < question.min! || value > question.max!) {
      return "Enter a whole number between " + question.min + " and " + question.max + ".";
    }
    if (question.key === "occupancy" && value > (profile.roommates ?? 0) + 1) return "That’s more people than your group. Check your answer.";
    if (question.key === "bedrooms") {
      const roomsForGroup = Math.ceil(((profile.roommates ?? 0) + 1) / (profile.share === "Yes" ? profile.occupancy ?? 1 : 1));
      if (value < roomsForGroup) return `Your group needs at least ${roomsForGroup} bedrooms with your room-sharing choice.`;
    }
    return null;
  }
  return typeof value === "string" && value.trim() ? null : "Please complete your answer.";
}
