import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function shouldUseSecureCookies() {
  return (
    process.env.APP_DEPLOYMENT === "hosted" ||
    !!process.env.VERCEL ||
    process.env.APP_BASE_URL?.startsWith("https://") === true
  );
}

/**
 * Page protection is deliberately separate from the API boundary. API routes
 * still call authenticate() because a proxy is an optimistic navigation guard,
 * not authorization for data or mutations.
 */
export async function proxy(request: NextRequest) {
  // Local fixture mode is loopback-only and is the explicit test/demo bypass.
  // Hosted deployments are rejected by configuration unless they use Supabase.
  if (process.env.DATA_BACKEND !== "supabase") return NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const loginUrl = new URL("/login", request.url);
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  if (!url || !key) {
    if (request.nextUrl.pathname === "/login") return NextResponse.next();
    loginUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.next({ request });
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, {
            ...options,
            httpOnly: true,
            sameSite: "lax",
            secure: shouldUseSecureCookies(),
          });
        });
      },
    },
  });

  let signedIn = false;
  try {
    const { data, error } = await client.auth.getUser();
    signedIn = !error && !!data.user;
  } catch {
    signedIn = false;
  }

  const redirect = (destination: URL) => {
    const next = NextResponse.redirect(destination);
    response.cookies.getAll().forEach((cookie) => next.cookies.set(cookie));
    return next;
  };

  if (request.nextUrl.pathname === "/login") {
    return signedIn
      ? redirect(new URL("/classroom", request.url))
      : response;
  }

  if (!signedIn) {
    loginUrl.searchParams.set("next", nextPath);
    return redirect(loginUrl);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf|woff|woff2|ico)$).*)",
  ],
};
