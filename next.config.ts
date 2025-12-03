import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Specify the correct workspace root to silence lockfile warning
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "panthernow.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
