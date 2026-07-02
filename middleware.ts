import { NextRequest, NextResponse } from "next/server";
import { opEnv } from "./lib/config";

/**
 * App-level Basic Auth gate for the hosted dashboard.
 *
 * Vercel Authentication (SSO) can't cover a custom production domain on the
 * Hobby plan, so 1op guards 1op.dev itself: one shared login, checked at the
 * edge. It activates ONLY when `OP_AUTH_PASSWORD` is set — so local dev and a
 * fresh clone stay open, and the lock engages only on the deployment where you
 * set the env vars. The browser caches the credentials, so it's one prompt on
 * your phone and you're in.
 *
 * This protects access, not data: the rendered bundle is already pointers-only
 * with dev creds redacted. The gate just keeps your app inventory private.
 */
export function middleware(req: NextRequest) {
  const password = opEnv("AUTH_PASSWORD");
  if (!password) return NextResponse.next(); // unset → open (local dev)

  const user = opEnv("AUTH_USER") || "1op";
  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice("Basic ".length));
    const sep = decoded.indexOf(":");
    const u = decoded.slice(0, sep);
    const p = decoded.slice(sep + 1);
    if (u === user && p === password) return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="1op", charset="UTF-8"' },
  });
}

export const config = {
  // Guard every page; skip Next internals and the favicon so the prompt is clean.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
