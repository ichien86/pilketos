export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let isRedirectingToLogin = false;

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
    const errorMsg = (data as { error?: string })?.error ?? res.statusText;

    // Deteksi sesi login kedaluwarsa atau akses ditolak di halaman internal
    if (
      typeof window !== "undefined" &&
      !isVoteEndpoint &&
      !url.startsWith("/api/auth/login") &&
      !url.startsWith("/api/akun/aktivasi") &&
      window.location.pathname !== "/" &&
      window.location.pathname !== "/aktivasi" &&
      (res.status === 401 || (res.status === 403 && errorMsg === "Tidak diizinkan"))
    ) {
      if (!isRedirectingToLogin) {
        isRedirectingToLogin = true;
        setTimeout(() => {
          window.location.href = "/?expired=1";
        }, 50);
      }
    }

    throw new ApiError(errorMsg, res.status);
  }
  return data as T;
}
