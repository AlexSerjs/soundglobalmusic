import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "e-cdns-images.dzcdn.net" },
      { protocol: "https", hostname: "cdns-images.dzcdn.net" },
      { protocol: "https", hostname: "cdn-images.dzcdn.net" },
      { protocol: "https", hostname: "**.last.fm" },                // Last.fm images
      { protocol: "https", hostname: "lastfm.freetls.fastly.net" },
    ],
  },
};

export default nextConfig;
