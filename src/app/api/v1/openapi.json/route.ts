import type { NextRequest } from "next/server";
import { openApiSpec } from "@/core/openapi";

export function GET(req: NextRequest) {
  return Response.json(openApiSpec(new URL(req.url).origin), { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" } });
}
