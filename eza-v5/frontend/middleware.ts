import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") || "";

  // 1) STANDALONE
  if (hostname === "standalone.ezacore.ai") {
    url.pathname = "/standalone";
    return NextResponse.rewrite(url);
  }

  // 2) PROXY
  if (hostname === "proxy.ezacore.ai") {
    url.pathname = "/panels/proxy";
    return NextResponse.rewrite(url);
  }

  // 3) PROXY-LITE
  if (hostname === "proxy-lite.ezacore.ai") {
    url.pathname = "/panels/proxy-lite";
    return NextResponse.rewrite(url);
  }

  // 4) ADMIN PANEL
  if (hostname === "admin.ezacore.ai") {
    url.pathname = "/panels/admin";
    return NextResponse.rewrite(url);
  }

  // 5) CORPORATE PANEL
  if (hostname === "corporate.ezacore.ai") {
    url.pathname = "/panels/corporate";
    return NextResponse.rewrite(url);
  }

  // 6) PLATFORM
  if (hostname === "platform.ezacore.ai") {
    url.pathname = "/panels/platform";
    return NextResponse.rewrite(url);
  }

  // 7) REGULATOR
  if (hostname === "regulator.ezacore.ai") {
    url.pathname = "/panels/regulator";
    return NextResponse.rewrite(url);
  }

  // 8) EU-AI
  if (hostname === "eu-ai.ezacore.ai") {
    url.pathname = "/panels/eu-ai";
    return NextResponse.rewrite(url);
  }

  // 9) SELECT PORTAL
  if (hostname === "select.ezacore.ai") {
    url.pathname = "/panels/select";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}
