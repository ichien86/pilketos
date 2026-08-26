"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/client-fetch";
import LogoutButton from "@/components/LogoutButton";

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
  pemilihan: "Pemilihan (Hari-H)",
};

// US-18 (kontrol fase) + US-21 (checklist Go/No-Go) + mode uji coba (lib/mode.ts).
export default function AdminFasePage() {
  const [fase, setFase] = useState<Fase[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [ujiCobaAktif, setUjiCobaAktif] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyMode, setBusyMode] = useState(false);

  async function refresh() {
    const [f, c, m] = await Promise.all([
      apiFetch<Fase[]>("/api/fase"),
      apiFetch<ChecklistItem[]>("/api/simulasi/checklist"),
      apiFetch<{ aktif: boolean }>("/api/mode/uji-coba"),
    ]);
    setFase(f);
    setChecklist(c);
    setUjiCobaAktif(m.aktif);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function toggleUjiCoba(aktif: boolean) {
    if (!aktif) {
      if (
        !confirm(
          "Matikan mode uji coba? SEMUA data uji coba (DPT, kandidat, video, status kelima fase, checklist, dst) akan dihapus total dan tidak bisa dikembalikan."
        )
      ) {
        return;
      }
    }
    setBusyMode(true);
    setError(null);
    try {
      await apiFetch("/api/mode/uji-coba", { method: "POST", body: JSON.stringify({ aktif }) });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengubah mode");
    } finally {
      setBusyMode(false);
    }
  }

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

  return (
    <main className="min-h-screen p-4 max-w-3xl mx-auto space-y-6">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-bold">Kontrol Fase</h1>
        <nav className="flex gap-3 text-sm text-blue-600">
          <a href="/admin/panitia" className="hover:underline">Panitia</a>
          <a href="/admin/rekonsiliasi" className="hover:underline">Rekonsiliasi</a>
          <LogoutButton />
        </nav>
      </header>

      <p className="text-xs text-slate-400">
        Pengelolaan DPT, kandidat, bilik, dan checklist Go/No-Go sudah dipindah ke panel panitia pemilihan (mereka login dengan akun panitia, bukan admin).
      </p>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className={`rounded-xl shadow p-4 space-y-2 ${ujiCobaAktif ? "bg-amber-50" : "bg-white"}`}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Mode Uji Coba</h2>
          <span className={`text-xs px-2 py-1 rounded-full font-mono ${ujiCobaAktif ? "bg-amber-400 text-amber-950" : "bg-slate-100 text-slate-500"}`}>
            {ujiCobaAktif ? "aktif" : "nonaktif"}
          </span>
        </div>
        <p className="text-sm text-slate-500">
          Bukan fase tersendiri -- ini flag yang menentukan apakah kelima fase di bawah (dan DPT/kandidat/sosialisasi/hari-H
          di dalamnya) sedang dijalankan untuk uji coba atau produksi sungguhan. Alurnya tetap sama persis, tetap harus
          dibuka berurutan dari Pendataan -- cuma datanya (termasuk status kelima fase itu sendiri) hidup di database
          terpisah selama mode ini aktif, dan hilang total begitu dimatikan.
        </p>
        <button
          onClick={() => toggleUjiCoba(!ujiCobaAktif)}
          disabled={busyMode}
          className={`text-sm rounded-lg px-3 py-1.5 text-white disabled:opacity-50 ${ujiCobaAktif ? "bg-red-600" : "bg-emerald-600"}`}
        >
          {ujiCobaAktif ? "Matikan Mode Uji Coba (reset semua data uji coba)" : "Aktifkan Mode Uji Coba"}
        </button>
      </div>

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
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold">Checklist Go/No-Go (sebelum buka fase Pemilihan)</h2>
          <span className="text-xs text-slate-400">{checklist.filter((c) => c.lolos).length} / {checklist.length} lolos</span>
        </div>
        <p className="text-xs text-slate-400 mb-2">Dicentang oleh panitia dari panel mereka -- tampilan di sini baca saja.</p>
        <div className="bg-white rounded-xl shadow divide-y">
          {checklist.map((c) => (
            <div key={c.kode} className="flex items-center gap-3 p-3">
              <span className={c.lolos ? "text-emerald-600" : "text-slate-400"}>{c.lolos ? "✓" : "○"}</span>
              <span className={c.lolos ? "text-emerald-700" : "text-slate-700"}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
