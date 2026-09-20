export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export async function api<T>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const response = await fetch(path, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(body !== undefined ? { "Idempotency-Key": crypto.randomUUID() } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("classcompass:unauthenticated"));
    }
    throw new ApiError(
      result.error?.message ??
        "Something went wrong. Your work is still saved; please try again.",
      result.error?.code ?? "REQUEST_FAILED",
      response.status,
      result.error?.retryAfterSeconds,
    );
  }
  return result.data as T;
}
