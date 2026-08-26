"use client";

import { useEffect, useState } from "react";

// US-19 AC -- indikator MODE UJI COBA yang jelas & mencolok di semua halaman
// selama mode ini aktif (lihat lib/mode.ts -- ini flag global, bukan fase).
export default function ModeSimulasiBanner() {
  const [ujiCobaAktif, setUjiCobaAktif] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function cek() {
      try {
        const res = await fetch("/api/mode/uji-coba");
        const data: { aktif: boolean } = await res.json();
        if (!cancelled) setUjiCobaAktif(data.aktif);
      } catch {
        // diamkan -- banner tidak kritikal untuk fungsi utama
      }
    }
    cek();
    const id = setInterval(cek, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!ujiCobaAktif) return null;
  return (
    <div className="sticky top-0 z-50 bg-amber-400 text-amber-950 text-center py-2 font-bold tracking-wide text-sm">
      ⚠ MODE UJI COBA -- DPT, kandidat, video, status fase, dan suara di sini terpisah dari data asli & akan HILANG TOTAL saat mode ini dimatikan
    </div>
  );
}
