import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "eslint",
    "eslint-plugin-react",
    "eslint-plugin-react-hooks",
    "typescript-eslint",
    "globals",
  ],
};

export default nextConfig;
