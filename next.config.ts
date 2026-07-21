import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Document uploads go through a server action as multipart form data; the
    // default 1 MB cap is far too small. The document store enforces a 25 MB
    // file cap (uploadDocument + the `documents` bucket in
    // 20260721101000_documents_storage.sql); this transport limit sits a little
    // above it so the multipart boundary overhead on a max-size file doesn't
    // trip Next's cryptic error before our friendly check runs.
    serverActions: { bodySizeLimit: "27mb" },
  },
};

export default nextConfig;
