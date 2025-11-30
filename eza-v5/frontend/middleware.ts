import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") || "";

  /* ------------------------------
   * 1) STANDALONE
   * ------------------------------ */
  if (hostname === "standalone.ezacore.ai") {
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = "/standalone";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ------------------------------
   * 2) PROXY
   * ------------------------------ */
  if (hostname === "proxy.ezacore.ai") {
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = "/panels/proxy";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ------------------------------
   * 3) PROXY-LITE
   * ------------------------------ */
  if (hostname === "proxy-lite.ezacore.ai") {
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = "/panels/proxy-lite";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ------------------------------
   * 4) ADMIN
   * ------------------------------ */
  if (hostname === "admin.ezacore.ai") {
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = "/panels/admin";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ------------------------------
   * 5) CORPORATE
   * ------------------------------ */
  if (hostname === "corporate.ezacore.ai") {
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = "/panels/corporate";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ------------------------------
   * 6) PLATFORM
   * ------------------------------ */
  if (hostname === "platform.ezacore.ai") {
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = "/panels/platform";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ------------------------------
   * 7) REGULATOR
   * ------------------------------ */
  if (hostname === "regulator.ezacore.ai") {
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = "/panels/regulator";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ------------------------------
   * 8) EU-AI
   * ------------------------------ */
  if (hostname === "eu-ai.ezacore.ai") {
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = "/panels/eu-ai";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ------------------------------
   * 9) SELECT
   * ------------------------------ */
  if (hostname === "select.ezacore.ai") {
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = "/panels/select";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}
