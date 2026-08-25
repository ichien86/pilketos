"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-fetch";

interface Fase {
  nama_fase: string;
  status: "belum_dibuka" | "aktif" | "ditutup";
}
interface ChecklistItem {
  kode: string;
  label: string;
  lolos: boolean;
}
interface Bilik {
  _id: string;
  nomor_bilik: number;
  status: "kosong" | "terisi";
}
interface Rekon {
  total_token_terbit: number;
  total_sudah_memilih: number;
  total_scan_keluar: number;
  total_suara: number;
  per_paslon: Array<{ kandidat_id: string; nomor_urut: number | null; nama: string; jumlah_suara: number }>;
  perlu_investigasi: boolean;
}

const NAMA_LABEL: Record<string, string> = {
  pendataan: "Pendataan",
  pendaftaran_calon: "Pendaftaran Calon",
  sosialisasi: "Sosialisasi",
  simulasi: "Simulasi (Gladi Bersih)",
  pemilihan: "Pemilihan (Hari-H)",
};

// Panitia Pengawas -- READ-ONLY murni. Tidak ada tombol aksi apa pun di
// halaman ini secara sengaja: peran ini dipisahkan dari "panitia" (panitia
// pemilihan) supaya ada pemisahan wewenang yang jelas untuk integritas
// pemilihan -- pengawas bisa memantau semuanya tapi tidak bisa mengubah
// data (ACC, scan, buka/tutup fase, dll semua ditolak API untuk peran ini).
export default function PengawasPage() {
  const [fase, setFase] = useState<Fase[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [bilik, setBilik] = useState<{ mode: string; bilik: Bilik[] } | null>(null);
  const [rekon, setRekon] = useState<Rekon | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [f, c] = await Promise.all([
        apiFetch<Fase[]>("/api/fase"),
        apiFetch<ChecklistItem[]>("/api/simulasi/checklist"),
      ]);
      setFase(f);
      setChecklist(c);
      // Pantauan bilik & rekonsiliasi cuma relevan kalau hari-H/simulasi
      // sedang atau sudah berjalan -- gagal diam-diam kalau belum, wajar.
      apiFetch<{ mode: string; bilik: Bilik[] }>("/api/panitia/bilik-monitor")
        .then(setBilik)
        .catch(() => setBilik(null));
      apiFetch<Rekon>("/api/admin/rekonsiliasi")
        .then(setRekon)
        .catch(() => setRekon(null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data");
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="min-h-screen p-4 max-w-3xl mx-auto space-y-6">
      <header className="pt-2">
        <h1 className="text-lg font-bold">Panel Pengawas</h1>
        <p className="text-sm text-slate-500">Akses pantau saja -- tidak ada aksi yang bisa diubah dari halaman ini.</p>
        <nav className="flex gap-3 text-sm text-blue-600 mt-2">
          <a href="/admin/dpt" className="hover:underline">DPT</a>
          <a href="/admin/kandidat" className="hover:underline">Kandidat</a>
          <a href="/admin/bilik" className="hover:underline">Bilik</a>
        </nav>
      </header>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <section className="bg-white rounded-xl shadow divide-y">
        {fase.map((f) => (
          <div key={f.nama_fase} className="flex items-center justify-between p-3">
            <span>{NAMA_LABEL[f.nama_fase] ?? f.nama_fase}</span>
            <span
              className={`text-xs px-2 py-1 rounded-full font-mono ${
                f.status === "aktif" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
              }`}
            >
              {f.status}
            </span>
          </div>
        ))}
      </section>

      <section>
        <h2 className="font-bold mb-2">Checklist Go/No-Go</h2>
        <div className="bg-white rounded-xl shadow divide-y">
          {checklist.map((c) => (
            <div key={c.kode} className="flex items-center gap-3 p-3">
              <span className={c.lolos ? "text-emerald-600" : "text-slate-400"}>{c.lolos ? "✓" : "○"}</span>
              <span className={c.lolos ? "text-emerald-700" : "text-slate-700"}>{c.label}</span>
            </div>
          ))}
        </div>
      </section>

      {bilik && (
        <section>
          <h2 className="font-bold mb-2">Pantauan Bilik ({bilik.mode})</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {bilik.bilik.map((b) => (
              <div
                key={b._id}
                className={`rounded-xl p-4 text-center font-bold shadow ${
                  b.status === "kosong" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                }`}
              >
                <div className="text-xl">{b.nomor_bilik}</div>
                <div className="text-xs mt-1">{b.status === "kosong" ? "Kosong" : "Terisi"}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {rekon && (
        <section>
          <h2 className="font-bold mb-2">Rekonsiliasi</h2>
          {rekon.perlu_investigasi && (
            <div className="bg-red-100 text-red-700 rounded-lg p-3 text-sm font-medium mb-3">
              Total sudah-memilih tidak sama dengan total suara -- perlu investigasi.
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Token terbit" value={rekon.total_token_terbit} />
            <Stat label="Sudah memilih" value={rekon.total_sudah_memilih} />
            <Stat label="Scan keluar" value={rekon.total_scan_keluar} />
            <Stat label="Total suara" value={rekon.total_suara} />
          </div>
        </section>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
