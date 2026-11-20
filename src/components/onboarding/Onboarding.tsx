"use client";

import {
  ActionIcon,
  Button,
  Menu,
  NumberInput,
  Textarea,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  campusHubs,
  housingProfileSchema,
  type HousingProfile,
  type CalendarDestination,
  type ProfileDraft,
  type SavedProfile,
} from "@/lib/contracts/housing-profile";
import { Icon } from "./Icon";
import { MatchesEntry } from "./MatchesPage";
import { PrioritySliders } from "./PrioritySliders";
import { defaultWeights } from "@/lib/contracts/matching-weights";
import { GroupDialog } from "@/components/groups/GroupDialog";
import type { GroupState } from "@/components/groups/GroupDashboard";
import { validateAnswer, visibleQuestions } from "./questions";
import styles from "./Onboarding.module.scss";

type Screen = "home" | "edit" | "survey" | "results";
type CalendarState = {
  available: boolean;
  connected: boolean;
  places: CalendarDestination[];
};

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

function QuestionTitle({
  title,
  emphasis,
}: {
  title: string;
  emphasis?: string;
}) {
  if (!emphasis) return title;
  const start = title.indexOf(emphasis);
  return (
    <>
      {title.slice(0, start)}
      <strong>{emphasis}</strong>
      {title.slice(start + emphasis.length)}
    </>
  );
}

export function Onboarding({ initialProfile, initialGroupOpen = false, initialCalendarReview = false }: { initialProfile?: SavedProfile; initialGroupOpen?: boolean; initialCalendarReview?: boolean }) {
  const [screen, setScreen] = useState<Screen>(initialProfile ? initialCalendarReview ? "survey" : "edit" : "home");
  const [profile, setProfile] = useState<ProfileDraft>(initialProfile?.profile ?? {});
  const [profileId, setProfileId] = useState(initialProfile?.id ?? "");
  const [step, setStep] = useState(initialProfile && initialCalendarReview ? 1 : 0);
  const [editing, setEditing] = useState(Boolean(initialProfile));
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [groupOpen, setGroupOpen] = useState(initialGroupOpen);
  const [calendarPlaces, setCalendarPlaces] = useState<CalendarDestination[]>(initialProfile?.profile.calendarDestinations ?? []);
  const content = useRef<HTMLElement>(null);
  const transitioning = useRef(false);
  const saving = useRef(false);
  const direction = useRef(1);
  const popup = useRef<Window | null>(null);
  const queryClient = useQueryClient();
  const questions = visibleQuestions(profile);
  const question = questions[step];
  const stage = screen === "home" ? 0 : screen === "results" ? 2 : 1;
  const profiles = useQuery({
    queryKey: ["profiles"],
    queryFn: ({ signal }) =>
      requestJson<SavedProfile[]>("/api/profiles", { signal }),
    initialData: initialProfile ? [initialProfile] : undefined,
  });
  const group = useQuery<GroupState>({
    queryKey: ["housing-group"],
    queryFn: ({ signal }) => requestJson<GroupState>("/api/groups", { signal }),
  });
  const calendar = useQuery({
    queryKey: ["calendar", initialCalendarReview || !initialProfile ? "review" : "status"],
    queryFn: ({ signal }) =>
      requestJson<CalendarState>("/api/calendar" + (initialCalendarReview || !initialProfile ? "?review=1" : ""), { signal }),
    enabled: screen === "survey" && question?.kind === "calendar",
    staleTime: Infinity,
    retry: false,
  });
  const saveProfile = useMutation({
    mutationFn: (value: SavedProfile) =>
      requestJson<SavedProfile>(editing ? `/api/profiles/${value.id}` : "/api/profiles", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? value.profile : value),
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData<SavedProfile[]>(["profiles"], current => current?.map(person => person.id === saved.id ? saved : person));
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["live-rank"] });
    },
  });

  async function signOut() {
    setSigningOut(true);
    setAccountError("");
    try {
      await requestJson("/api/auth/sign-out", { method: "POST" });
      queryClient.clear();
      window.location.assign("/");
    } catch {
      setAccountError("Couldn’t sign out. Please try again.");
      setSigningOut(false);
    }
  }

  const navigate = useCallback(async (change: () => void, movement = 1) => {
    if (transitioning.current || saving.current) return;
    transitioning.current = true;
    direction.current = movement;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (content.current && !reduceMotion) {
      await content.current
        .animate(
          [
            { opacity: 1, transform: "translateY(0)" },
            { opacity: 0, transform: "translateY(" + -movement * 18 + "px)" },
          ],
          { duration: 130, easing: "ease-in", fill: "forwards" },
        )
        .finished.catch(() => undefined);
    }
    setError("");
    change();
  }, []);

  useEffect(() => {
    const element = content.current;
    element?.getAnimations().forEach((animation) => animation.cancel());
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const animation = !reduceMotion
      ? element?.animate(
          [
            {
              opacity: 0,
              transform: "translateY(" + direction.current * 18 + "px)",
            },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 220, easing: "cubic-bezier(.2,.7,.2,1)" },
        )
      : undefined;
    const focus = () => {
      transitioning.current = false;
      const input =
        screen === "survey"
          ? element?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
              'input:not([type="hidden"]), textarea',
            )
          : null;
      (input || element?.querySelector<HTMLElement>("h1"))?.focus({
        preventScroll: true,
      });
    };
    if (animation) animation.finished.then(focus).catch(() => undefined);
    else focus();
    return () => animation?.cancel();
  }, [screen, step]);

  useEffect(() => {
    if (calendar.data?.connected && (initialCalendarReview || !initialProfile)) setCalendarPlaces(calendar.data.places);
  }, [calendar.data, initialCalendarReview, initialProfile]);

  useEffect(() => {
    function receiveCalendar(event: MessageEvent) {
      if (
        event.origin !== window.location.origin ||
        event.source !== popup.current
      )
        return;
      if (event.data === "calendar-connected")
        window.location.assign("/?calendar=review");
      if (event.data === "calendar-error")
        setError("Calendar could not connect. Please retry or skip for now.");
      if (event.data === "calendar-account-error")
        setError("Use the same Google account as your sign-in. Sign in again, then retry.");
    }
    window.addEventListener("message", receiveCalendar);
    return () => window.removeEventListener("message", receiveCalendar);
  }, []);

  function update(key: keyof HousingProfile, value: unknown) {
    setProfile((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function selectOption(option: string) {
    if (question.kind === "multiple") {
      const selected = profile.hubs || [];
      const hub = option as (typeof campusHubs)[number];
      if (!selected.includes(hub) && selected.length === 3) {
        setError("You’ve chosen three places. Deselect one to choose another.");
        return;
      }
      update(
        "hubs",
        selected.includes(hub)
          ? selected.filter((value) => value !== hub)
          : [...selected, hub],
      );
    } else {
      update(question.key as keyof HousingProfile, option);
    }
  }

  async function next() {
    if (transitioning.current || saving.current) return;
    if (question.kind === "calendar" && calendarPlaces.length > 4) {
      setError("Choose up to four frequent places. Exclude the others before continuing.");
      return;
    }
    if (question.kind === "calendar" && calendarPlaces.some(place => !place.name.trim() || !/\d/.test(place.address))) {
      setError("Add a street address for each place, or exclude places you do not want to rank.");
      return;
    }
    if (question.kind === "calendar" && new Set(calendarPlaces.map(place => place.name.trim().toLowerCase())).size !== calendarPlaces.length) {
      setError("Use a different name for each place, or exclude duplicates.");
      return;
    }
    const message = validateAnswer(question, profile);
    if (message) {
      setError(message);
      content.current?.querySelector<HTMLInputElement>("input")?.focus();
      return;
    }
    if (!editing && step < questions.length - 1) {
      if (question.kind === "calendar") update("calendarDestinations", calendarPlaces);
      await navigate(() => setStep((current) => current + 1));
      return;
    }
    const completed = housingProfileSchema.safeParse({
      ...profile,
      walk: Object.fromEntries(
        (profile.hubs || [])
          .filter((hub) => profile.walk?.[hub] !== undefined)
          .map((hub) => [hub, profile.walk![hub]]),
      ),
      occupancy:
        profile.roommates && profile.share === "Yes" ? Math.min(profile.occupancy ?? 1, profile.roommates + 1) : 1,
      share: profile.roommates ? profile.share : "No",
      bus: profile.car === "No" ? (profile.bus ?? null) : null,
      group: profile.roommates ? profile.group : null,
      interests: profile.interests || "",
      calendarDestinations: question.kind === "calendar" ? calendarPlaces : profile.calendarDestinations,
    });
    if (!completed.success) {
      setError(
        completed.error.issues[0].message + " Use Back to review your answers.",
      );
      return;
    }
    saving.current = true;
    try {
      const saved = await saveProfile.mutateAsync({ id: profileId, profile: completed.data });
      saving.current = false;
      await navigate(() => {
        setProfile(saved.profile);
        setScreen("results");
      });
    } catch (failure) {
      saving.current = false;
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save. Please retry.",
      );
    }
  }

  function back() {
    navigate(() => {
      if (editing) {
        setProfile(queryClient.getQueryData<SavedProfile[]>(["profiles"])?.find(person => person.id === profileId)?.profile ?? profile);
        setScreen("edit");
      }
      else if (step === 0) setScreen("home");
      else setStep((current) => current - 1);
    }, -1);
  }

  function keyboard(event: KeyboardEvent) {
    if (
      screen !== "survey" ||
      transitioning.current ||
      saving.current ||
      event.nativeEvent.isComposing
    )
      return;
    const target = event.target as HTMLElement;
    if (target.closest('[role="menu"], [data-account-menu]')) return;
    if (target.matches("select")) return;
    const editing = target.matches("input,textarea");
    if (event.key === "Enter") {
      if (target.matches("textarea") && !event.metaKey && !event.ctrlKey)
        return;
      if (target.closest("button") && !target.closest("[data-choice]")) return;
      event.preventDefault();
      next();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || editing) return;
    const numberedChoices = question.key === "hubs";
    if (
      (numberedChoices ? /^[1-9]$/ : /^[a-z]$/i).test(event.key) &&
      question.options
    ) {
      const index = numberedChoices
        ? Number(event.key) - 1
        : event.key.toUpperCase().charCodeAt(0) - 65;
      if (question.options[index]) {
        event.preventDefault();
        selectOption(question.options[index]);
        content.current
          ?.querySelectorAll<HTMLButtonElement>("[data-choice]")
          [index]?.focus();
      }
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const options = Array.from(
        content.current?.querySelectorAll<HTMLButtonElement>("[data-choice]") ||
          [],
      );
      if (options.length) {
        event.preventDefault();
        const index = options.indexOf(target as HTMLButtonElement);
        const offset = event.key === "ArrowDown" ? 1 : -1;
        options[(index + offset + options.length) % options.length].focus();
      }
    }
  }

  const choiceQuestion =
    question?.kind === "choices" || question?.kind === "multiple";
  const ready = !choiceQuestion || !validateAnswer(question, profile);
  const fieldClasses = {
    root: styles.fieldRoot,
    input: styles.fieldInput,
    label: styles.fieldLabel,
  };
  const title =
    screen === "home"
      ? "Your housing search"
      : screen === "edit"
        ? "Edit your profile"
      : screen === "results"
        ? profile.name + "’s shortlist"
        : question.title;

  if (screen === "results")
    return (
      <MatchesEntry profile={profile as HousingProfile} profileId={profileId} />
    );

  return (
    <div className={styles.shell} onKeyDown={keyboard}>
      <header className={styles.header}>
        <UnstyledButton
          className={styles.brand}
          aria-label="Back to profiles"
          disabled={saveProfile.isPending}
          onClick={() =>
            screen !== "home" && navigate(() => setScreen(initialProfile ? "results" : "home"), -1)
          }
        >
          HomeWork
        </UnstyledButton>
        <ol className={styles.stages} aria-label="Progress">
          {[
            "Create your profile",
            "Customize your search",
            "View your matches",
          ].map((label, index) => (
            <li
              key={label}
              data-state={
                index < stage
                  ? "done"
                  : index === stage
                    ? "current"
                    : "upcoming"
              }
              aria-current={index === stage ? "step" : undefined}
            >
              <span className={styles.stageNumber}>
                {index < stage ? <Icon name="check" size={14} /> : index + 1}
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
        <div className={styles.account} data-account-menu>
          <Menu position="bottom-end" offset={8} width={225} radius={6} shadow="sm" classNames={{ dropdown: styles.accountDropdown, item: styles.accountItem }}>
            <Menu.Target>
              <UnstyledButton className={styles.accountButton} aria-label="Account menu" disabled={saveProfile.isPending || signingOut}>
                <Icon name="user" size={19} />
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<Icon name="sliders" size={16} />} disabled={profiles.isPending || profiles.isError} onClick={() => {
                const person = profiles.data?.find(person => person.id === profileId) ?? profiles.data?.[0];
                if (person) {
                  navigate(() => {
                    setProfile(person.profile);
                    setProfileId(person.id);
                    setEditing(true);
                    setScreen("edit");
                  });
                } else if (screen === "home") {
                  navigate(() => {
                    setEditing(false);
                    setProfile({ weights: { ...defaultWeights } });
                    setProfileId(crypto.randomUUID());
                    setStep(0);
                    setCalendarPlaces([]);
                    setScreen("survey");
                  });
                }
              }}>Profile / preferences</Menu.Item>
              <Menu.Item leftSection={<Icon name="house" size={16} />} onClick={() => setGroupOpen(true)}>{group.isPending ? "Housing group" : group.data?.group ? "Group settings" : "Start a group"}</Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<Icon name="logout" size={16} />} onClick={signOut}>Sign out</Menu.Item>
            </Menu.Dropdown>
          </Menu>
          {accountError && <p className={styles.accountError} role="alert">{accountError}</p>}
        </div>
      </header>
      <main
        className={`${styles.panel} ${screen === "survey" && question.kind === "priorities" ? styles.prioritySurvey : ""} ${screen === "edit" ? styles.editPanel : ""}`}
      >
        {screen === "survey" && (
          <span
            className={styles.progress}
            aria-label={"Question " + (step + 1) + " of " + questions.length}
          >
            {step + 1} / {questions.length}
          </span>
        )}
        <section
          ref={content}
          className={styles.content}
          aria-labelledby="question-title"
        >
          <h1 id="question-title" className={styles.question} tabIndex={-1}>
            <span className={styles.questionNumber} aria-hidden="true">
              {screen === "home" ? 1 : step + 1}
              <Icon name="arrow" size={14} />
            </span>
            <QuestionTitle
              title={title}
              emphasis={screen === "survey" ? question.emphasis : undefined}
            />
          </h1>
          {screen === "home" && (
            <>
              {initialCalendarReview && <p className={styles.status}>Calendar connected. Create your profile to review frequent places.</p>}
              <div className={styles.choices}>
                {!profiles.data?.length && <UnstyledButton
                  className={styles.choice}
                  onClick={() =>
                    navigate(() => {
                      setEditing(false);
                      setProfile({ weights: { ...defaultWeights } });
                      setProfileId(crypto.randomUUID());
                      setStep(0);
                      setCalendarPlaces([]);
                      setScreen("survey");
                    })
                  }
                >
                  <span className={styles.shortcut}>
                    <Icon name="plus" size={14} />
                  </span>
                  <span>Create your profile</span>
                </UnstyledButton>}
                <UnstyledButton className={styles.choice} onClick={() => setGroupOpen(true)}>
                  <span className={styles.shortcut}><Icon name="plus" size={14} /></span>
                  {group.isPending ? "Housing group" : group.data?.group ? "Group settings" : "Start a group"}
                </UnstyledButton>
                {profiles.data?.map((person) => (
                  <div key={person.id} className={styles.profileChoices}>
                    <UnstyledButton className={styles.choice} onClick={() => navigate(() => {
                      setProfile(person.profile);
                      setProfileId(person.id);
                      setScreen("results");
                    })}>
                      <span className={styles.shortcut}><Icon name="arrow" size={14} /></span>
                      View {person.profile.name}’s matches
                    </UnstyledButton>
                    <UnstyledButton className={styles.choice} onClick={() => navigate(() => {
                      setProfile(person.profile);
                      setProfileId(person.id);
                      setEditing(true);
                      setScreen("edit");
                    })}>
                      <span className={styles.shortcut}><Icon name="sliders" size={14} /></span>
                      Edit your profile
                    </UnstyledButton>
                  </div>
                ))}
              </div>
              {profiles.isPending && (
                <p className={styles.status}>Loading profile…</p>
              )}
              {profiles.isError && (
                <p role="alert" className={styles.status}>
                  Your profile couldn’t load.
                  <UnstyledButton
                    className={styles.retry}
                    onClick={() => profiles.refetch()}
                  >
                    Retry
                  </UnstyledButton>
                </p>
              )}
            </>
          )}
          {screen === "edit" && (
            <div className={styles.editChoices}>
              <UnstyledButton className={styles.choice} onClick={() => navigate(() => setScreen("results"))}>
                <span className={styles.shortcut}><Icon name="arrow" size={14} /></span>
                View updated matches
              </UnstyledButton>
              {questions.map(item => {
                const value = profile[item.key as keyof ProfileDraft];
                return <UnstyledButton key={item.key} className={styles.choice} onClick={() => navigate(() => {
                  setStep(questions.findIndex(question => question.key === item.key));
                  setScreen("survey");
                })}>
                  <span className={styles.choiceLabel}>{item.title}</span>
                  <span className={styles.editValue}>{item.kind === "calendar" ? "Connect or update" : Array.isArray(value) ? value.join(", ") : typeof value === "string" || typeof value === "number" ? value : "Edit"}</span>
                </UnstyledButton>;
              })}
            </div>
          )}
          {screen === "survey" && (
            <>
              {question.description && (
                <p id="question-description" className={styles.description}>
                  {question.description}
                </p>
              )}
              {question.kind === "priorities" && (
                <PrioritySliders
                  weights={profile.weights ?? defaultWeights}
                  onChange={(weights) => update("weights", weights)}
                  disabled={saveProfile.isPending}
                />
              )}
              {choiceQuestion && (
                <div
                  className={styles.choices}
                  role="group"
                  aria-label={question.title}
                  aria-describedby={error ? "question-error" : undefined}
                >
                  {question.options!.map((option, index) => {
                    const selected =
                      question.kind === "multiple"
                        ? profile.hubs?.includes(
                            option as (typeof campusHubs)[number],
                          )
                        : profile[question.key as keyof ProfileDraft] ===
                          option;
                    return (
                      <UnstyledButton
                        key={option}
                        className={styles.choice}
                        data-choice
                        aria-pressed={Boolean(selected)}
                        onClick={() => selectOption(option)}
                      >
                        <span className={styles.shortcut} aria-hidden="true">
                          {question.key === "hubs"
                            ? index + 1
                            : String.fromCharCode(65 + index)}
                        </span>
                        <span className={styles.choiceLabel}>{option}</span>
                        <span className={styles.selectedIcon}>
                          <Icon name="check" size={18} />
                        </span>
                      </UnstyledButton>
                    );
                  })}
                </div>
              )}
              {question.kind === "text" && (
                <TextInput
                  key={question.key}
                  classNames={fieldClasses}
                  aria-label={question.title}
                  aria-describedby={error ? "question-error" : undefined}
                  error={Boolean(error)}
                  autoComplete={question.key === "name" ? "given-name" : "off"}
                  placeholder="Type your answer…"
                  maxLength={question.key === "name" ? 100 : 200}
                  value={String(
                    profile[question.key as keyof ProfileDraft] ?? "",
                  )}
                  onChange={(event) =>
                    update(
                      question.key as keyof HousingProfile,
                      event.currentTarget.value,
                    )
                  }
                />
              )}
              {question.kind === "number" && (
                <NumberInput
                  key={question.key}
                  classNames={fieldClasses}
                  aria-label={question.title}
                  aria-describedby={
                    error
                      ? "question-error"
                      : question.description
                        ? "question-description"
                        : undefined
                  }
                  error={Boolean(error)}
                  placeholder={question.key === "bus" ? "No limit" : "0"}
                  hideControls
                  allowDecimal={false}
                  allowNegative={false}
                  min={question.min}
                  max={question.max}
                  clampBehavior="none"
                  value={
                    (profile[question.key as keyof ProfileDraft] as number) ??
                    ""
                  }
                  onChange={(value) =>
                    update(
                      question.key as keyof HousingProfile,
                      typeof value === "number" ? value : undefined,
                    )
                  }
                />
              )}
              {question.kind === "distances" && (
                <div className={styles.distances}>
                  {profile.hubs?.map((hub) => (
                    <NumberInput
                      key={hub}
                      label={`${hub} (optional)`}
                      classNames={fieldClasses}
                      placeholder="No limit"
                      hideControls
                      min={1}
                      max={120}
                      allowNegative={false}
                      allowDecimal={false}
                      clampBehavior="none"
                      error={Boolean(error)}
                      aria-describedby={
                        error ? "question-error" : "question-description"
                      }
                      value={profile.walk?.[hub] ?? ""}
                      onChange={(value) =>
                        update("walk", {
                          ...profile.walk,
                          [hub]: typeof value === "number" ? value : undefined,
                        })
                      }
                    />
                  ))}
                </div>
              )}
              {question.kind === "textarea" && (
                <Textarea
                  classNames={fieldClasses}
                  aria-label={question.title}
                  placeholder="Tell us a little about yourself…"
                  autosize
                  minRows={2}
                  maxRows={6}
                  maxLength={4000}
                  value={profile.interests || ""}
                  onChange={(event) =>
                    update("interests", event.currentTarget.value)
                  }
                />
              )}
              {question.kind === "calendar" && (
                <>
                  {calendar.isPending && (
                    <p className={styles.status}>
                      Checking calendar connection…
                    </p>
                  )}
                  {calendar.data?.available && (
                    <Button
                      className={styles.continue}
                      onClick={() => {
                        popup.current = window.open(
                          "/api/calendar/connect",
                          "housing-calendar",
                          "width=520,height=680",
                        );
                        if (!popup.current)
                          setError(
                            "Allow the sign-in window to connect your calendar.",
                          );
                      }}
                    >
                      {calendar.data.connected
                        ? "Reconnect calendar"
                        : "Connect Google Calendar"}
                    </Button>
                  )}
                  {calendar.data && !calendar.data.available && (
                    <p className={styles.status}>
                      Calendar connection isn’t available yet. You can continue
                      with your campus destinations.
                    </p>
                  )}
                  {calendar.isError && (
                    <p role="alert" className={styles.status}>
                      Could not check your calendar.
                      <UnstyledButton
                        className={styles.retry}
                        onClick={() => calendar.refetch()}
                      >
                        Retry
                      </UnstyledButton>
                    </p>
                  )}
                  {calendar.data?.connected && (initialCalendarReview || !initialProfile) && !calendar.data.places.length && !calendarPlaces.length && (
                    <p className={styles.status}>
                      No recurring place appears at least 20 times in the next 120 days.
                    </p>
                  )}
                  <div className={styles.calendarLocations}>
                    {calendarPlaces.length > 4 && <p className={styles.status}>Choose up to four places for house ranking. <UnstyledButton className={styles.retry} onClick={() => setCalendarPlaces(current => current.slice(0, 4))}>Keep four most frequent</UnstyledButton></p>}
                    {calendarPlaces.map((place, index) => (
                      <div key={index} className={styles.calendarPlace}>
                        <p className={styles.status}>{place.count} visits in 120 days</p>
                        <TextInput classNames={fieldClasses} label="Place name" value={place.name} maxLength={100}
                          onChange={change => { const name = change.currentTarget.value; setCalendarPlaces(current => current.map((item, position) => position === index ? { ...item, name } : item)); }} />
                        <TextInput classNames={fieldClasses} label="Street address" value={place.address} maxLength={200}
                          onChange={change => { const address = change.currentTarget.value; setCalendarPlaces(current => current.map((item, position) => position === index ? { ...item, address } : item)); }} />
                        <UnstyledButton className={styles.retry} onClick={() => setCalendarPlaces(current => current.filter((_, position) => position !== index))}>Exclude place</UnstyledButton>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className={styles.confirmation} hidden={!ready}>
                <Button
                  className={styles.continue}
                  loading={saveProfile.isPending}
                  onClick={next}
                >
                  {editing ? "Save change" : step === questions.length - 1
                    ? "Finished"
                    : question.kind === "calendar" && !calendar.data?.connected
                      ? "Skip for now"
                      : "Continue"}
                </Button>
                {!choiceQuestion && (
                  <span className={styles.enterHint}>
                    press{" "}
                    <strong>
                      {question.kind === "textarea"
                        ? "Ctrl / ⌘ + Enter"
                        : "Enter"}
                    </strong>
                    <Icon name="enter" size={14} />
                  </span>
                )}
              </div>
              {error && (
                <p id="question-error" role="alert" className={styles.error}>
                  {error}
                </p>
              )}
            </>
          )}
        </section>
        {screen === "survey" && !editing && (
          <div className={styles.navigation} aria-label="Question navigation">
            <ActionIcon
              aria-label="Previous question"
              onClick={back}
              disabled={saveProfile.isPending}
            >
              <Icon name="up" size={19} />
            </ActionIcon>
            <ActionIcon
              aria-label="Next question"
              onClick={next}
              disabled={saveProfile.isPending}
            >
              <Icon name="down" size={19} />
            </ActionIcon>
          </div>
        )}
      </main>
      <GroupDialog opened={groupOpen} onClose={() => setGroupOpen(false)} />
    </div>
  );
}
