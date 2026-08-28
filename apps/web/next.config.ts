import type { NextConfig } from "next";

const config: NextConfig = {
  // Prisma và fs chỉ chạy phía server.
  serverExternalPackages: ["@prisma/client"],
};

export default config;
