import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /* Video thumbnails in the Bytes digest. The generator rewrites every
       YouTube still to this one canonical host (i.ytimg.com/vi/<id>/…) rather
       than trusting the feed's rotating i1-i4 mirrors, so a single exact
       pattern covers the source and nothing else can be optimized through us. */
    remotePatterns: [new URL("https://i.ytimg.com/vi/**")],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
