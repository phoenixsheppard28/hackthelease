"use client";

import { ActionIcon, Button, NativeSelect, NumberInput, Textarea, TextInput, UnstyledButton } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { campusHubs, housingProfileSchema, type HousingProfile, type ProfileDraft, type SavedProfile } from "@/lib/contracts/housing-profile";
import { Icon } from "./Icon";
import { MatchesEntry } from "./MatchesPage";
import { PrioritySliders } from "./PrioritySliders";
import { defaultWeights } from "@/lib/contracts/matching-weights";
import { validateAnswer, visibleQuestions } from "./questions";
import styles from "./Onboarding.module.scss";

type Screen = "home" | "survey" | "results";
type CalendarEvent = { time: string; location: string; hub?: typeof campusHubs[number] };
type CalendarState = { available: boolean; connected: boolean; events: CalendarEvent[] };

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

function QuestionTitle({ title, emphasis }: { title: string; emphasis?: string }) {
  if (!emphasis) return title;
  const start = title.indexOf(emphasis);
  return <>{title.slice(0, start)}<strong>{emphasis}</strong>{title.slice(start + emphasis.length)}</>;
}

export function Onboarding() {
  const [screen, setScreen] = useState<Screen>("home");
  const [profile, setProfile] = useState<ProfileDraft>({});
  const [profileId, setProfileId] = useState("");
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const content = useRef<HTMLElement>(null);
  const transitioning = useRef(false);
  const saving = useRef(false);
  const direction = useRef(1);
  const popup = useRef<Window | null>(null);
  const queryClient = useQueryClient();
  const questions = visibleQuestions(profile);
  const question = questions[step];
  const stage = screen === "home" ? 0 : screen === "survey" ? 1 : 2;
  const profiles = useQuery({
    queryKey: ["profiles"],
    queryFn: ({ signal }) => requestJson<SavedProfile[]>("/api/profiles", { signal }),
  });
  const calendar = useQuery({
    queryKey: ["calendar"],
    queryFn: ({ signal }) => requestJson<CalendarState>("/api/calendar", { signal }),
    enabled: screen === "survey" && question?.kind === "calendar",
    retry: false,
  });
  const saveProfile = useMutation({
    mutationFn: (value: SavedProfile) => requestJson<SavedProfile>("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profiles"] }),
  });

  const navigate = useCallback(async (change: () => void, movement = 1) => {
    if (transitioning.current || saving.current) return;
    transitioning.current = true;
    direction.current = movement;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (content.current && !reduceMotion) {
      await content.current.animate(
        [{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(" + (-movement * 18) + "px)" }],
        { duration: 130, easing: "ease-in", fill: "forwards" },
      ).finished.catch(() => undefined);
    }
    setError("");
    change();
  }, []);

  useEffect(() => {
    const element = content.current;
    element?.getAnimations().forEach(animation => animation.cancel());
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animation = !reduceMotion ? element?.animate(
      [{ opacity: 0, transform: "translateY(" + (direction.current * 18) + "px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 220, easing: "cubic-bezier(.2,.7,.2,1)" },
    ) : undefined;
    const focus = () => {
      transitioning.current = false;
      const input = screen === "survey" ? element?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input:not([type="hidden"]), textarea') : null;
      (input || element?.querySelector<HTMLElement>("h1"))?.focus({ preventScroll: true });
    };
    if (animation) animation.finished.then(focus).catch(() => undefined);
    else focus();
    return () => animation?.cancel();
  }, [screen, step]);

  useEffect(() => {
    if (calendar.data?.connected) setCalendarEvents(calendar.data.events);
  }, [calendar.data]);

  useEffect(() => {
    function receiveCalendar(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== popup.current) return;
      if (event.data === "calendar-connected") queryClient.invalidateQueries({ queryKey: ["calendar"] });
      if (event.data === "calendar-error") setError("Calendar could not connect. Please retry or skip for now.");
    }
    window.addEventListener("message", receiveCalendar);
    return () => window.removeEventListener("message", receiveCalendar);
  }, [queryClient]);

  function update(key: keyof HousingProfile, value: unknown) {
    setProfile(current => ({ ...current, [key]: value }));
    setError("");
  }

  function selectOption(option: string) {
    if (question.kind === "multiple") {
      const selected = profile.hubs || [];
      const hub = option as typeof campusHubs[number];
      if (!selected.includes(hub) && selected.length === 3) {
        setError("You’ve chosen three places. Deselect one to choose another.");
        return;
      }
      update("hubs", selected.includes(hub) ? selected.filter(value => value !== hub) : [...selected, hub]);
    } else {
      update(question.key as keyof HousingProfile, option);
    }
  }

  async function next() {
    if (transitioning.current || saving.current) return;
    const message = validateAnswer(question, profile);
    if (message) {
      setError(message);
      content.current?.querySelector<HTMLInputElement>("input")?.focus();
      return;
    }
    if (step < questions.length - 1) {
      await navigate(() => setStep(current => current + 1));
      return;
    }
    const completed = housingProfileSchema.safeParse({
      ...profile,
      walk: Object.fromEntries((profile.hubs || [])
        .filter(hub => profile.walk?.[hub] !== undefined)
        .map(hub => [hub, profile.walk![hub]])),
      occupancy: profile.roommates && profile.share === "Yes" ? profile.occupancy : 1,
      share: profile.roommates ? profile.share : "No",
      bus: profile.car === "No" ? profile.bus ?? null : null,
      group: profile.roommates ? profile.group : null,
      interests: profile.interests || "",
      schedule: calendarEvents.filter(event => event.hub),
    });
    if (!completed.success) {
      setError(completed.error.issues[0].message + " Use Back to review your answers.");
      return;
    }
    saving.current = true;
    try {
      await saveProfile.mutateAsync({ id: profileId, profile: completed.data });
      saving.current = false;
      await navigate(() => { setProfile(completed.data); setScreen("results"); });
    } catch (failure) {
      saving.current = false;
      setError(failure instanceof Error ? failure.message : "Could not save. Please retry.");
    }
  }

  function back() {
    navigate(() => {
      if (step === 0) setScreen("home");
      else setStep(current => current - 1);
    }, -1);
  }

  function keyboard(event: KeyboardEvent) {
    if (screen !== "survey" || transitioning.current || saving.current || event.nativeEvent.isComposing) return;
    const target = event.target as HTMLElement;
    if (target.matches("select")) return;
    const editing = target.matches("input,textarea");
    if (event.key === "Enter") {
      if (target.matches("textarea") && !event.metaKey && !event.ctrlKey) return;
      if (target.closest("button") && !target.closest("[data-choice]")) return;
      event.preventDefault();
      next();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || editing) return;
    const numberedChoices = question.key === "hubs";
    if ((numberedChoices ? /^[1-9]$/ : /^[a-z]$/i).test(event.key) && question.options) {
      const index = numberedChoices ? Number(event.key) - 1 : event.key.toUpperCase().charCodeAt(0) - 65;
      if (question.options[index]) {
        event.preventDefault();
        selectOption(question.options[index]);
        content.current?.querySelectorAll<HTMLButtonElement>("[data-choice]")[index]?.focus();
      }
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const options = Array.from(content.current?.querySelectorAll<HTMLButtonElement>("[data-choice]") || []);
      if (options.length) {
        event.preventDefault();
        const index = options.indexOf(target as HTMLButtonElement);
        const offset = event.key === "ArrowDown" ? 1 : -1;
        options[(index + offset + options.length) % options.length].focus();
      }
    }
  }

  const choiceQuestion = question?.kind === "choices" || question?.kind === "multiple";
  const ready = !choiceQuestion || !validateAnswer(question, profile);
  const fieldClasses = { root: styles.fieldRoot, input: styles.fieldInput, label: styles.fieldLabel };
  const title = screen === "home" ? "Whose housing search?" : screen === "results" ? profile.name + "’s shortlist" : question.title;

  if (screen === "results") return <MatchesEntry profile={profile as HousingProfile} profileId={profileId} />;

  return (
    <div className={styles.shell} onKeyDown={keyboard}>
      <header className={styles.header}>
        <UnstyledButton className={styles.brand} aria-label="Back to profiles" disabled={saveProfile.isPending} onClick={() => screen !== "home" && navigate(() => setScreen("home"), -1)}>
          Hack the Lease
        </UnstyledButton>
        <ol className={styles.stages} aria-label="Progress">
          {["Choose a student", "Customize your search", "View your matches"].map((label, index) => (
            <li key={label} data-state={index < stage ? "done" : index === stage ? "current" : "upcoming"} aria-current={index === stage ? "step" : undefined}>
              <span className={styles.stageNumber}>{index < stage ? <Icon name="check" size={14} /> : index + 1}</span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
      </header>
      <main className={`${styles.panel} ${screen === "survey" && question.kind === "priorities" ? styles.prioritySurvey : ""}`}>
        {screen === "survey" && <span className={styles.progress} aria-label={"Question " + (step + 1) + " of " + questions.length}>{step + 1} / {questions.length}</span>}
        <section ref={content} className={styles.content} aria-labelledby="question-title">
          <h1 id="question-title" className={styles.question} tabIndex={-1}>
            <span className={styles.questionNumber} aria-hidden="true">{screen === "home" ? 1 : step + 1}<Icon name="arrow" size={14} /></span>
            <QuestionTitle title={title} emphasis={screen === "survey" ? question.emphasis : undefined} />
          </h1>
          {screen === "home" && <>
            <div className={styles.choices}>
              <UnstyledButton className={styles.choice} onClick={() => navigate(() => {
                setProfile({ weights: { ...defaultWeights } }); setProfileId(crypto.randomUUID()); setStep(0); setCalendarEvents([]); setScreen("survey");
              })}>
                <span className={styles.shortcut}><Icon name="plus" size={14} /></span>
                <span>New student</span>
              </UnstyledButton>
              {profiles.data?.map(person => (
                <UnstyledButton key={person.id} className={styles.choice} onClick={() => navigate(() => { setProfile(person.profile); setProfileId(person.id); setScreen("results"); })}>
                  <span className={styles.shortcut}><Icon name="arrow" size={14} /></span>{person.profile.name}
                </UnstyledButton>
              ))}
            </div>
            {profiles.isPending && <p className={styles.status}>Loading students…</p>}
            {profiles.isError && <p role="alert" className={styles.status}>Saved students couldn’t load.<UnstyledButton className={styles.retry} onClick={() => profiles.refetch()}>Retry</UnstyledButton></p>}
          </>}
          {screen === "survey" && <>
            {question.description && <p id="question-description" className={styles.description}>{question.description}</p>}
            {question.kind === "priorities" && <PrioritySliders
              weights={profile.weights ?? defaultWeights}
              onChange={weights => update("weights", weights)}
              disabled={saveProfile.isPending}
            />}
            {choiceQuestion && <div className={styles.choices} role="group" aria-label={question.title} aria-describedby={error ? "question-error" : undefined}>
              {question.options!.map((option, index) => {
                const selected = question.kind === "multiple" ? profile.hubs?.includes(option as typeof campusHubs[number]) : profile[question.key as keyof ProfileDraft] === option;
                return <UnstyledButton key={option} className={styles.choice} data-choice aria-pressed={Boolean(selected)} onClick={() => selectOption(option)}>
                  <span className={styles.shortcut} aria-hidden="true">{question.key === "hubs" ? index + 1 : String.fromCharCode(65 + index)}</span>
                  <span className={styles.choiceLabel}>{option}</span>
                  <span className={styles.selectedIcon}><Icon name="check" size={18} /></span>
                </UnstyledButton>;
              })}
            </div>}
            {question.kind === "text" && <TextInput
              key={question.key} classNames={fieldClasses} aria-label={question.title} aria-describedby={error ? "question-error" : undefined}
              error={Boolean(error)} autoComplete={question.key === "name" ? "given-name" : "off"}
              placeholder="Type your answer…" maxLength={question.key === "name" ? 100 : 200}
              value={String(profile[question.key as keyof ProfileDraft] ?? "")}
              onChange={event => update(question.key as keyof HousingProfile, event.currentTarget.value)}
            />}
            {question.kind === "number" && <NumberInput
              key={question.key} classNames={fieldClasses} aria-label={question.title}
              aria-describedby={error ? "question-error" : question.description ? "question-description" : undefined}
              error={Boolean(error)} placeholder={question.key === "bus" ? "No limit" : "0"} hideControls allowDecimal={false} allowNegative={false}
              min={question.min} max={question.max} clampBehavior="none"
              value={profile[question.key as keyof ProfileDraft] as number ?? ""}
              onChange={value => update(question.key as keyof HousingProfile, typeof value === "number" ? value : undefined)}
            />}
            {question.kind === "distances" && <div className={styles.distances}>
              {profile.hubs?.map(hub => <NumberInput key={hub} label={`${hub} (optional)`} classNames={fieldClasses}
                placeholder="No limit" hideControls min={1} max={120} allowNegative={false} allowDecimal={false} clampBehavior="none"
                error={Boolean(error)} aria-describedby={error ? "question-error" : "question-description"}
                value={profile.walk?.[hub] ?? ""}
                onChange={value => update("walk", { ...profile.walk, [hub]: typeof value === "number" ? value : undefined })}
              />)}
            </div>}
            {question.kind === "textarea" && <Textarea classNames={fieldClasses} aria-label={question.title} placeholder="Tell us a little about yourself…"
              autosize minRows={2} maxRows={6} maxLength={4000} value={profile.interests || ""}
              onChange={event => update("interests", event.currentTarget.value)}
            />}
            {question.kind === "calendar" && <>
              {calendar.isPending && <p className={styles.status}>Checking calendar connection…</p>}
              {calendar.data?.available && <Button className={styles.continue} onClick={() => {
                popup.current = window.open("/api/calendar/connect", "housing-calendar", "width=520,height=680");
                if (!popup.current) setError("Allow the sign-in window to connect your calendar.");
              }}>{calendar.data.connected ? "Reconnect calendar" : "Connect Google Calendar"}</Button>}
              {calendar.data && !calendar.data.available && <p className={styles.status}>Calendar connection isn’t available yet. You can continue with your campus destinations.</p>}
              {calendar.isError && <p role="alert" className={styles.status}>Could not check your calendar.<UnstyledButton className={styles.retry} onClick={() => calendar.refetch()}>Retry</UnstyledButton></p>}
              {calendar.data?.connected && !calendarEvents.length && <p className={styles.status}>No upcoming timed events with locations found.</p>}
              <div className={styles.calendarLocations}>
                {calendarEvents.map((event, index) => <NativeSelect key={event.time + index}
                  label={event.time.slice(0, 16).replace("T", " ") + " · " + event.location}
                  data={["Skip event", ...campusHubs]} value={event.hub || "Skip event"}
                  onChange={change => setCalendarEvents(current => current.map((item, position) => position === index ? {
                    ...item, hub: change.target.value === "Skip event" ? undefined : change.target.value as typeof campusHubs[number],
                  } : item))}
                />)}
              </div>
            </>}
            <div className={styles.confirmation} hidden={!ready}>
              <Button className={styles.continue} loading={saveProfile.isPending} onClick={next}>
                {step === questions.length - 1 ? "Finished" : question.kind === "calendar" && !calendar.data?.connected ? "Skip for now" : "Continue"}
              </Button>
              {!choiceQuestion && <span className={styles.enterHint}>press <strong>{question.kind === "textarea" ? "Ctrl / ⌘ + Enter" : "Enter"}</strong><Icon name="enter" size={14} /></span>}
            </div>
            {error && <p id="question-error" role="alert" className={styles.error}>{error}</p>}
          </>}
        </section>
        {screen === "survey" && <div className={styles.navigation} aria-label="Question navigation">
          <ActionIcon aria-label="Previous question" onClick={back} disabled={saveProfile.isPending}><Icon name="up" size={19} /></ActionIcon>
          <ActionIcon aria-label="Next question" onClick={next} disabled={saveProfile.isPending}><Icon name="down" size={19} /></ActionIcon>
        </div>}
      </main>
    </div>
  );
}
