import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // De foto-niveaus staan bewust NIET in /public (anders kan iedereen de scherpe foto openen).
  // Deze regel zorgt dat Vercel ze toch meeneemt in de serverless functie van /api/photo.
  outputFileTracingIncludes: {
    "/api/photo": ["./private/photo/**"],
  },
};

export default nextConfig;
