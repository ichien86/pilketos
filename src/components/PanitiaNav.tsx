"use client";

import { useEffect, useState } from "react";
import LogoutButton from "@/components/LogoutButton";
import { apiFetch } from "@/lib/client-fetch";

interface FaseItem {
  nama_fase: string;
  status: "belum_dibuka" | "aktif" | "ditutup";
  dibuka_at: string | null;
}

const FASE_LABEL: Record<string, string> = {
  pendataan: "Pendataan DPT",
  pendaftaran_calon: "Pendaftaran Calon",
  sosialisasi: "Sosialisasi & Video",
  pemilihan: "Pemilihan (Hari-H)",
};

const ITEMS = [
  { href: "/panitia", label: "Panel" },
  { href: "/admin/dpt", label: "DPT" },
  { href: "/admin/kandidat", label: "Kandidat" },
  { href: "/admin/bilik", label: "Bilik" },
  { href: "/panitia/checkin", label: "Check-in" },
  { href: "/panitia/bilik-monitor", label: "Pantauan Bilik" },
  { href: "/panitia/exit-scan", label: "Scan Keluar" },
  { href: "/admin/rekonsiliasi", label: "Rekonsiliasi" },
] as const;

// Nav konsisten di semua halaman yang dipakai panitia pemilihan -- supaya
// bisa lompat ke tools lain tanpa harus balik ke /panitia setiap kali.
// bisa lompat ke tools lain tanpa harus balik ke /panitia setiap kali,
// lengkap dengan indikator status jadwal/tahapan yang sedang aktif saat ini.
export default function PanitiaNav({ active }: { active: string }) {
  const [faseAktif, setFaseAktif] = useState<FaseItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<FaseItem[]>("/api/fase")
      .then((all) => {
        if (cancelled) return;
        const aktif = all.find((f) => f.status === "aktif") ?? null;
        setFaseAktif(aktif);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={item.href === active ? "font-bold text-slate-900" : "text-blue-600 hover:underline"}
            >
              {item.label}
            </a>
          ))}
          <LogoutButton />
        </nav>

        {/* Badge Status Jadwal Aktif */}
        {faseAktif ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-sm shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>
              Jadwal Aktif: <strong>{FASE_LABEL[faseAktif.nama_fase] ?? faseAktif.nama_fase}</strong>
            </span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            <span>Tidak ada jadwal aktif</span>
          </span>
        )}
      </div>
    </div>
  );
}
