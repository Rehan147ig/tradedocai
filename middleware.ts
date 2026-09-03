import { NextResponse, NextRequest } from "next/server";
import { getClientKey, rateLimit } from "@/lib/rate-limit";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Security headers for all routes
  const res = NextResponse.next();
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("X-XSS-Protection", "0"); // modern browsers ignore, CSP does work
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    res.headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.interfaze.ai https://integrate.api.nvidia.com https://api.openai.com https://generativelanguage.googleapis.com;");
  }

  // Rate limit API routes — 60 req/min per IP for generic, 10/min for auth/webhooks burst protection
  if (pathname.startsWith("/api/")) {
    const isAuth = pathname.startsWith("/api/auth/");
    const isWebhook = pathname.startsWith("/api/shopify/webhooks/");
    const key = `${getClientKey(request as unknown as Request)}:${isAuth ? "auth" : isWebhook ? "wh" : "api"}`;
    const limit = isAuth ? { windowMs: 60_000, max: 10 } : isWebhook ? { windowMs: 60_000, max: 60 } : { windowMs: 60_000, max: 120 };
    const { allowed, remaining, resetMs } = rateLimit({ ...limit, key });
    res.headers.set("X-RateLimit-Remaining", String(remaining));
    res.headers.set("X-RateLimit-Reset", String(Math.ceil(resetMs / 1000)));
    if (!allowed) {
      return new NextResponse(JSON.stringify({ error: "Rate limit exceeded. Slow down." }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil(resetMs / 1000)), ...Object.fromEntries(res.headers.entries()) },
      });
    }
  }

  return res;
}

export const config = {
  matcher: ["/api/:path*", "/shopify/:path*", "/dashboard/:path*"],
};
