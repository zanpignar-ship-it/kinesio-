import { NextResponse, type NextRequest } from "next/server";

/** Cheap gate: unauthenticated visitors to /app go to login. Real checks happen server-side per request. */
export function middleware(req: NextRequest) {
  if (!req.cookies.get("rentora_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*"] };
