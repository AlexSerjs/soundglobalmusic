import { NextRequest, NextResponse } from "next/server";

// ── Fake 404 page HTML (looks like a real Next.js / generic server 404) ───────
const FAKE_404 = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>404 - Page Not Found</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#000;display:flex;align-items:center;justify-content:center;min-height:100vh}
    .wrap{display:flex;align-items:center;gap:20px}
    h1{font-size:24px;font-weight:500;border-right:1px solid rgba(0,0,0,.3);padding-right:20px;margin-right:4px}
    p{font-size:14px}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>404</h1>
    <p>This page could not be found.</p>
  </div>
</body>
</html>`;

// ── Check if an IP address is from a private/local network ────────────────────
function isLocalIP(ip: string): boolean {
  if (!ip) return false;

  // Strip IPv6-mapped IPv4 prefix (::ffff:192.168.1.1)
  const clean = ip.replace(/^::ffff:/, "").trim();

  // Loopback
  if (clean === "127.0.0.1" || clean === "::1" || clean === "localhost") return true;

  const parts = clean.split(".").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;

  const [a, b] = parts;

  return (
    a === 10 ||                          // 10.0.0.0/8
    a === 127 ||                         // 127.0.0.0/8
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168)             // 192.168.0.0/16
  );
}

// ── Extract real client IP from request headers ───────────────────────────────
function getClientIP(req: NextRequest): string {
  // Order of trust: direct connection IP → Nginx X-Real-IP → X-Forwarded-For
  // (Cloudflare CF-Connecting-IP is intentionally NOT used here — tunneled
  //  external traffic should remain blocked even if CF adds that header.)
  const candidates = [
    req.headers.get("x-real-ip"),
    req.headers.get("x-forwarded-for")?.split(",")[0],
    // request.ip is available in Edge runtime (not in Node middleware, but try anyway)
    (req as unknown as { ip?: string }).ip,
  ];

  for (const c of candidates) {
    if (c?.trim()) return c.trim();
  }
  return "";
}

// ── Middleware ────────────────────────────────────────────────────────────────
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only guard /admin routes
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  const ip = getClientIP(req);

  if (isLocalIP(ip)) {
    // Local network — allow through
    return NextResponse.next();
  }

  // Not local → return convincing 404 (no redirect, same URL)
  return new NextResponse(FAKE_404, {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
