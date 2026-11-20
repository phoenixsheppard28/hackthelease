import type { Metadata } from "next";
import "@mantine/core/styles.css";
import "@/styles/globals.scss";
import { Providers } from "./providers";

export const metadata: Metadata = { title: "Homework", description: "Find housing that fits your week." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><Providers>{children}</Providers></body></html>;
}
