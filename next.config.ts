import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/attendance/*": ["./node_modules/@expo-google-fonts/noto-sans-sc/400Regular/*.ttf"],
    "/api/admin/reports/pdf": ["./node_modules/@expo-google-fonts/noto-sans-sc/400Regular/*.ttf"],
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(self), geolocation=(), microphone=(), browsing-topics=()" },
      ],
    }];
  },
};

export default nextConfig;
