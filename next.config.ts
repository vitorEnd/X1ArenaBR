import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 90],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "jirvnmesmffivaqzdxus.supabase.co",
        pathname: "/storage/v1/object/public/player-avatars/**",
      },
    ],
  },
};

export default nextConfig;
