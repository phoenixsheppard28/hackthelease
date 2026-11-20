import type { NextConfig } from "next";

const config: NextConfig = {
  images: { remotePatterns: process.env.SUPABASE_URL ? [{ protocol: "https", hostname: new URL(process.env.SUPABASE_URL).hostname, pathname: "/storage/v1/object/public/listing-images/**", port: "", search: "" }] : [] },
  experimental: { optimizePackageImports: ["@mantine/core", "@mantine/hooks"] },
  devIndicators: false,
};
export default config;
