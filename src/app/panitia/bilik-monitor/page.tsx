"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-fetch";
import LogoutButton from "@/components/LogoutButton";

interface Bilik {
  _id: string;
  nomor_bilik: number;
  status: "kosong" | "terisi";
}

// US-26 -- status semua bilik secara real-time di satu layar pantauan.
export default function BilikMonitorPage() {
  const [bilik, setBilik] = useState<Bilik[]>([]);
  const [mode, setMode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await apiFetch<{ mode: string; bilik: Bilik[] }>("/api/panitia/bilik-monitor");
        if (!cancelled) {
          setBilik(res.bilik);
          setMode(res.mode);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Gagal memuat");
      }
    }
    load();
    const id = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto space-y-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-bold">Pantauan Bilik {mode && `(${mode})`}</h1>
        <nav className="flex items-center gap-3 text-sm">
          <a href="/panitia" className="text-blue-600 hover:underline">Panel</a>
          <a href="/panitia/checkin" className="text-blue-600 hover:underline">Check-in</a>
          <LogoutButton />
        </nav>
      </header>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {bilik.map((b) => (
          <div
            key={b._id}
            className={`rounded-xl p-6 text-center font-bold shadow ${
              b.status === "kosong" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
            }`}
          >
            <div className="text-2xl">{b.nomor_bilik}</div>
            <div className="text-xs mt-1">{b.status === "kosong" ? "Kosong" : "Terisi"}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
