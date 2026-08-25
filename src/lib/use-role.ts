"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-fetch";

// Dipakai halaman yang dibagi panitia (tulis) & pengawas (baca saja) supaya
// tahu peran pengguna saat ini dan bisa sembunyikan kontrol aksi untuk
// pengawas -- backend tetap sumber kebenaran (menolak 403), ini cuma UX.
export function useRole(): string | null {
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    apiFetch<{ authenticated: boolean; role?: string }>("/api/auth/me")
      .then((res) => setRole(res.role ?? null))
      .catch(() => setRole(null));
  }, []);
  return role;
}
