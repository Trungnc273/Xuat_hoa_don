import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sinh bản build tối giản để đóng gói Docker (chỉ chứa file cần chạy)
  output: "standalone",
};

export default nextConfig;
