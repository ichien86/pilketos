"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client-fetch";

export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function keluar() {
    if (busy) return;
    setBusy(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <button onClick={keluar} disabled={busy} className={className ?? "text-sm text-red-600 hover:underline disabled:opacity-50"}>
      Keluar
    </button>
  );
}
