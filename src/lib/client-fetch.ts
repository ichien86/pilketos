export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const isVoteEndpoint = url.startsWith("/api/vote");
  const res = await fetch(url, {
    ...init,
    credentials: init?.credentials ?? (isVoteEndpoint ? "omit" : "include"),
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { "content-type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    throw new ApiError((data as { error?: string })?.error ?? res.statusText, res.status);
  }
  return data as T;
}
