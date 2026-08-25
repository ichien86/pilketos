"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-fetch";
import PanitiaNav from "@/components/PanitiaNav";

interface ChecklistItem {
  kode: string;
  label: string;
  lolos: boolean;
  catatan: string | null;
}

// US-21 -- checklist Go/No-Go, gerbang wajib sebelum admin bisa buka fase
// Pemilihan. Panitia yang verifikasi kesiapan lapangan (bilik, device, dst)
// dan mencentang di sini; admin tetap satu-satunya yang bisa menekan "Buka".
export default function PanitiaChecklistPage() {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  async function refresh() {
    setChecklist(await apiFetch<ChecklistItem[]>("/api/simulasi/checklist"));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function toggle(kode: string, lolos: boolean) {
    await apiFetch("/api/simulasi/checklist", { method: "PATCH", body: JSON.stringify({ kode, lolos }) });
    refresh();
  }

  const totalLolos = checklist.filter((c) => c.lolos).length;

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto space-y-6">
      <header className="space-y-2 pt-2">
        <h1 className="text-lg font-bold">Checklist Go/No-Go</h1>
        <PanitiaNav active="/panitia/checklist" />
      </header>

      <p className="text-sm text-slate-500">
        {totalLolos} / {checklist.length} sudah lolos. Fase Pemilihan hanya bisa dibuka admin kalau semuanya sudah dicentang.
      </p>

      <div className="bg-white rounded-xl shadow divide-y">
        {checklist.map((c) => (
          <label key={c.kode} className="flex items-center gap-3 p-3 cursor-pointer">
            <input type="checkbox" checked={c.lolos} onChange={(e) => toggle(c.kode, e.target.checked)} />
            <span className={c.lolos ? "text-emerald-700" : "text-slate-700"}>{c.label}</span>
          </label>
        ))}
        {checklist.length === 0 && <p className="text-sm text-slate-400 p-4 text-center">Memuat...</p>}
      </div>
    </main>
  );
}
