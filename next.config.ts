import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // The assistant accepts image/PDF uploads up to 10MB, sent as base64 (+33%) with chat history.
    proxyClientMaxBodySize: "16mb",
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
