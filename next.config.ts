import os from "node:os";
import type { NextConfig } from "next";

function localDevOrigins() {
  const origins = new Set(["localhost", "127.0.0.1", "10.0.2.2"]);
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const net of addresses ?? []) {
      const ipv4 = net.family === "IPv4";
      if (ipv4 && !net.internal) origins.add(net.address);
    }
  }
  return [...origins];
}

const nextConfig: NextConfig = {
  allowedDevOrigins: localDevOrigins(),
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/kaffey.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="kaffey.apk"' },
        ],
      },
    ];
  },
};

export default nextConfig;
