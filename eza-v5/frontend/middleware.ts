import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") || "";

  /* 1) Standalone */
  if (hostname === "standalone.ezacore.ai") {
    url.pathname = "/standalone";
    return NextResponse.rewrite(url);
  }

  /* 2) PROXY → login ekranı */
  if (hostname === "proxy.ezacore.ai") {
    url.pathname = "/admin/login"; // 🔥 doğru path
    return NextResponse.rewrite(url);
  }

  /* 3) PROXY-LITE */
  if (hostname === "proxy-lite.ezacore.ai") {
    url.pathname = "/panels/proxy-lite";
    return NextResponse.rewrite(url);
  }

  /* 4) ADMIN → /admin */
  if (hostname === "admin.ezacore.ai") {
    url.pathname = "/admin"; // 🔥 doğru path
    return NextResponse.rewrite(url);
  }

  /* 5) CORPORATE */
  if (hostname === "corporate.ezacore.ai") {
    url.pathname = "/panels/corporate";
    return NextResponse.rewrite(url);
  }

  /* 6) PLATFORM */
  if (hostname === "platform.ezacore.ai") {
    url.pathname = "/panels/platform";
    return NextResponse.rewrite(url);
  }

  /* 7) REGULATOR */
  if (hostname === "regulator.ezacore.ai") {
    url.pathname = "/panels/regulator";
    return NextResponse.rewrite(url);
  }

  /* 8) EU-AI */
  if (hostname === "eu-ai.ezacore.ai") {
    url.pathname = "/panels/eu-ai";
    return NextResponse.rewrite(url);
  }

  /* 9) SELECT */
  if (hostname === "select.ezacore.ai") {
    url.pathname = "/panels/select";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}
