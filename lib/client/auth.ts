/**
 * Keep post-login navigation inside ClassCompass. The value originates in a
 * query parameter, so it must never be passed straight to the router.
 */
export function safeReturnPath(
  value: string | null | undefined,
  fallback = "/classroom",
) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return fallback;
  }

  try {
    const destination = new URL(value, "https://classcompass.invalid");
    if (destination.origin !== "https://classcompass.invalid") return fallback;
    if (destination.pathname === "/login") {
      return fallback;
    }
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}
