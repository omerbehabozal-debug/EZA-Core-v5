import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") || "";

  if (hostname === "standalone.ezacore.ai") {
    return NextResponse.redirect(new URL("/standalone", req.url));
  }

  if (hostname === "proxy.ezacore.ai") {
    return NextResponse.redirect(new URL("/panels/proxy", req.url));
  }

  if (hostname === "proxy-lite.ezacore.ai") {
    return NextResponse.redirect(new URL("/panels/proxy-lite", req.url));
  }

  if (hostname === "admin.ezacore.ai") {
    return NextResponse.redirect(new URL("/panels/admin", req.url));
  }

  if (hostname === "corporate.ezacore.ai") {
    return NextResponse.redirect(new URL("/panels/corporate", req.url));
  }

  if (hostname === "platform.ezacore.ai") {
    return NextResponse.redirect(new URL("/panels/platform", req.url));
  }

  if (hostname === "regulator.ezacore.ai") {
    return NextResponse.redirect(new URL("/panels/regulator", req.url));
  }

  if (hostname === "eu-ai.ezacore.ai") {
    return NextResponse.redirect(new URL("/panels/eu-ai", req.url));
  }

  if (hostname === "select.ezacore.ai") {
    return NextResponse.redirect(new URL("/panels/select", req.url));
  }

  return NextResponse.next();
}
