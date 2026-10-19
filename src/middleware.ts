import type { NextRequest } from "next/server";
import { isAuthorized, unauthorizedResponse } from "@/lib/auth.mjs";

export function middleware(request: NextRequest) {
  return isAuthorized(request.headers) ? undefined : unauthorizedResponse();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg).*)"],
};
