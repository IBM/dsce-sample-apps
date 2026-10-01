import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained server in .next/standalone — used by Docker image
  output: "standalone",

  // Allow Next.js <Image> to serve logo from public/ without domain restriction
  images: {
    unoptimized: true, // logo.png served as-is from /public
  },
};

export default nextConfig;
