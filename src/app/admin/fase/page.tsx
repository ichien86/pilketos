"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/client-fetch";

interface Fase {
  nama_fase: string;
  status: "belum_dibuka" | "aktif" | "ditutup";
  dibuka_at: string | null;
  ditutup_at: string | null;
}
interface ChecklistItem {
  kode: string;
  label: string;
  lolos: boolean;
  catatan: string | null;
}

const NAMA_LABEL: Record<string, string> = {
  pendataan: "Pendataan",
  pendaftaran_calon: "Pendaftaran Calon",
  sosialisasi: "Sosialisasi",
  simulasi: "Simulasi (Gladi Bersih)",
  pemilihan: "Pemilihan (Hari-H)",
};

// US-18 (kontrol fase) + US-21 (checklist Go/No-Go).
export default function AdminFasePage() {
  const [fase, setFase] = useState<Fase[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [f, c] = await Promise.all([
      apiFetch<Fase[]>("/api/fase"),
      apiFetch<ChecklistItem[]>("/api/simulasi/checklist"),
    ]);
    setFase(f);
    setChecklist(c);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function buka(nama: string, force = false) {
    setError(null);
    try {
      await apiFetch(`/api/fase/${nama}/buka`, { method: "POST", body: JSON.stringify({ force }) });
      refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && !force) {
        if (confirm(`${e.message}\n\nKonfirmasi sekali lagi: buka ulang fase ini sebagai skenario darurat?`)) {
          if (confirm("Yakin sekali lagi? Tindakan ini tidak biasa dan sebaiknya dihindari kecuali darurat.")) {
            return buka(nama, true);
          }
        }
        return;
      }
      setError(e instanceof Error ? e.message : "Gagal membuka fase");
    }
  }

  async function tutup(nama: string) {
    setError(null);
    try {
      await apiFetch(`/api/fase/${nama}/tutup`, { method: "POST" });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menutup fase");
    }
  }

  async function toggleChecklist(kode: string, lolos: boolean) {
    await apiFetch("/api/simulasi/checklist", { method: "PATCH", body: JSON.stringify({ kode, lolos }) });
    refresh();
  }

  return (
    <main className="min-h-screen p-4 max-w-3xl mx-auto space-y-6">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-bold">Kontrol Fase</h1>
        <nav className="flex gap-3 text-sm text-blue-600">
          <a href="/admin/dpt" className="hover:underline">DPT</a>
          <a href="/admin/kandidat" className="hover:underline">Kandidat</a>
          <a href="/admin/bilik" className="hover:underline">Bilik</a>
          <a href="/admin/rekonsiliasi" className="hover:underline">Rekonsiliasi</a>
          <a href="/admin/panitia" className="hover:underline">Panitia</a>
        </nav>
      </header>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="space-y-3">
        {fase.map((f) => (
          <div key={f.nama_fase} className="bg-white rounded-xl shadow p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{NAMA_LABEL[f.nama_fase] ?? f.nama_fase}</p>
              <p className="text-xs text-slate-500">
                status: <span className="font-mono">{f.status}</span>
              </p>
            </div>
            <div className="flex gap-2">
              {f.status !== "aktif" && (
                <button onClick={() => buka(f.nama_fase)} className="text-sm bg-emerald-600 text-white rounded-lg px-3 py-1.5">
                  Buka
                </button>
              )}
              {f.status === "aktif" && (
                <button onClick={() => tutup(f.nama_fase)} className="text-sm bg-red-600 text-white rounded-lg px-3 py-1.5">
                  Tutup
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="font-bold mb-2">Checklist Go/No-Go (sebelum buka fase Pemilihan)</h2>
        <div className="bg-white rounded-xl shadow divide-y">
          {checklist.map((c) => (
            <label key={c.kode} className="flex items-center gap-3 p-3 cursor-pointer">
              <input type="checkbox" checked={c.lolos} onChange={(e) => toggleChecklist(c.kode, e.target.checked)} />
              <span className={c.lolos ? "text-emerald-700" : "text-slate-700"}>{c.label}</span>
            </label>
          ))}
        </div>
      </div>
    </main>
  );
}
