import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Statik yollar — ASLA rewrite edilmeyecek
const PUBLIC_PATHS = [
  "/_next",         // Next.js statik dosyalar
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.json",
  "/assets",
  "/images",
  "/api",           // API çağrıları
  "/auth",          // Auth endpoints
];

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") || "";

  // Eğer statik dosyalardan biri çağrılıyorsa → rewrite etme
  if (PUBLIC_PATHS.some((p) => url.pathname.startsWith(p))) {
    return NextResponse.next();
  }

  /* ---------------------------------------------------
   * 1) STANDALONE
   * standalone.ezacore.ai
   ---------------------------------------------------- */
  if (hostname === "standalone.ezacore.ai") {
    if (!url.pathname.startsWith("/standalone")) {
      url.pathname = "/standalone";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ---------------------------------------------------
   * 2) PROXY
   * proxy.ezacore.ai
   ---------------------------------------------------- */
  if (hostname === "proxy.ezacore.ai") {
    if (!url.pathname.startsWith("/panels/proxy")) {
      url.pathname = "/panels/proxy";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ---------------------------------------------------
   * 3) PROXY-LITE
   * proxy-lite.ezacore.ai
   ---------------------------------------------------- */
  if (hostname === "proxy-lite.ezacore.ai") {
    if (!url.pathname.startsWith("/panels/proxy-lite")) {
      url.pathname = "/panels/proxy-lite";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ---------------------------------------------------
   * 4) ADMIN
   * admin.ezacore.ai
   ---------------------------------------------------- */
  if (hostname === "admin.ezacore.ai") {
    if (!url.pathname.startsWith("/panels/admin")) {
      url.pathname = "/panels/admin";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ---------------------------------------------------
   * 5) CORPORATE
   * corporate.ezacore.ai
   ---------------------------------------------------- */
  if (hostname === "corporate.ezacore.ai") {
    if (!url.pathname.startsWith("/panels/corporate")) {
      url.pathname = "/panels/corporate";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ---------------------------------------------------
   * 6) PLATFORM
   * platform.ezacore.ai
   ---------------------------------------------------- */
  if (hostname === "platform.ezacore.ai") {
    if (!url.pathname.startsWith("/panels/platform")) {
      url.pathname = "/panels/platform";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ---------------------------------------------------
   * 7) REGULATOR
   * regulator.ezacore.ai
   ---------------------------------------------------- */
  if (hostname === "regulator.ezacore.ai") {
    if (!url.pathname.startsWith("/panels/regulator")) {
      url.pathname = "/panels/regulator";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ---------------------------------------------------
   * 8) EU-AI
   * eu-ai.ezacore.ai
   ---------------------------------------------------- */
  if (hostname === "eu-ai.ezacore.ai") {
    if (!url.pathname.startsWith("/panels/eu-ai")) {
      url.pathname = "/panels/eu-ai";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ---------------------------------------------------
   * 9) SELECT PORTAL
   * select.ezacore.ai
   ---------------------------------------------------- */
  if (hostname === "select.ezacore.ai") {
    if (!url.pathname.startsWith("/panels/select")) {
      url.pathname = "/panels/select";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // Diğer her şey normal çalışsın
  return NextResponse.next();
}
