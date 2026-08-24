"use client";

import { useEffect, useState } from "react";
import type { KontrolFase } from "@/types";

// US-19 AC -- indikator MODE SIMULASI yang jelas & mencolok di semua halaman
// aktif selama fase simulasi berlangsung.
export default function ModeSimulasiBanner() {
  const [simulasiAktif, setSimulasiAktif] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function cek() {
      try {
        const res = await fetch("/api/fase");
        const data: KontrolFase[] = await res.json();
        const s = data.find((f) => f.nama_fase === "simulasi");
        if (!cancelled) setSimulasiAktif(s?.status === "aktif");
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

  if (!simulasiAktif) return null;
  return (
    <div className="sticky top-0 z-50 bg-amber-400 text-amber-950 text-center py-2 font-bold tracking-wide text-sm">
      ⚠ MODE SIMULASI -- data & suara di halaman ini TIDAK dihitung sebagai hasil sungguhan
    </div>
  );
}
