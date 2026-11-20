type IconName = "arrow" | "up" | "down" | "check" | "plus" | "enter" | "search" | "heart" | "sliders" | "house" | "user" | "logout" | "pencil";

const paths: Record<IconName, string> = {
  arrow: "M3 12h16m-6-6 6 6-6 6",
  up: "m5 15 7-7 7 7",
  down: "m5 9 7 7 7-7",
  check: "m4 12 5 5L20 6",
  plus: "M12 4v16M4 12h16",
  enter: "M20 5v9H4m5-5-5 5 5 5",
  search: "M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15M16 16l5 5",
  heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  sliders: "M4 7h7m4 0h5M4 17h3m4 0h9M11 4v6M7 14v6",
  house: "m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8",
  user: "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 21v-2a8 6 0 0 1 16 0v2",
  logout: "M9 4H4v16h5M10 12h11m-4-4 4 4-4 4",
  pencil: "m4 20 4.5-1 10-10a2 2 0 0 0-3-3l-10 10L4 20ZM14 7l3 3",
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d={paths[name]} stroke="currentColor" strokeWidth={name === "arrow" ? 3 : 2.2} strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}
