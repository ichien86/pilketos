"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-fetch";
import { useRole } from "@/lib/use-role";
import PanitiaNav from "@/components/PanitiaNav";

interface Rekon {
  mode: string;
  total_token_terbit: number;
  total_sudah_memilih: number;
  total_scan_keluar: number;
  total_suara: number;
  per_paslon: Array<{ kandidat_id: string; nomor_urut: number | null; nama: string; jumlah_suara: number }>;
  perlu_investigasi: boolean;
}
interface Fase {
  nama_fase: string;
  status: "belum_dibuka" | "aktif" | "ditutup";
  hasil_diumumkan: boolean;
}
interface BarisToken {
  nama: string;
  nis_nip: string;
  kelas_atau_pangkat: string | null;
  status: string;
  antre_at: string;
  sudah_scan_keluar: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  menunggu: "Menunggu bilik",
  di_bilik: "Di bilik",
  sudah_memilih: "Sudah memilih",
  selesai: "Selesai",
  kedaluwarsa: "Kedaluwarsa",
};

// US-17 -- rekap agregat, tanpa membuka data mentah siapa pun.
export default function RekonsiliasiPage() {
  const role = useRole();
  const isAdmin = role === "admin";
  const [mode, setMode] = useState<"prod" | "simulasi">("prod");
  const [data, setData] = useState<Rekon | null>(null);
  const [fasePemilihan, setFasePemilihan] = useState<Fase | null>(null);
  const [umumkanBusy, setUmumkanBusy] = useState(false);
  const [umumkanError, setUmumkanError] = useState<string | null>(null);
  const [daftarToken, setDaftarToken] = useState<BarisToken[] | null>(null);
  const [daftarBusy, setDaftarBusy] = useState(false);

  useEffect(() => {
    apiFetch<Rekon>(`/api/admin/rekonsiliasi?mode=${mode}`).then(setData);
    setDaftarToken(null); // tutup daftar lama kalau mode (Produksi/Simulasi) diganti
  }, [mode]);

  async function toggleDaftarToken() {
    if (daftarToken) {
      setDaftarToken(null);
      return;
    }
    setDaftarBusy(true);
    try {
      const res = await apiFetch<{ daftar: BarisToken[] }>(`/api/admin/rekonsiliasi/daftar-token?mode=${mode}`);
      setDaftarToken(res.daftar);
    } finally {
      setDaftarBusy(false);
    }
  }

  async function refreshFasePemilihan() {
    const all = await apiFetch<Fase[]>("/api/fase");
    setFasePemilihan(all.find((f) => f.nama_fase === "pemilihan") ?? null);
  }

  useEffect(() => {
    refreshFasePemilihan();
  }, []);

  async function toggleUmumkan(umumkan: boolean) {
    setUmumkanBusy(true);
    setUmumkanError(null);
    try {
      await apiFetch("/api/fase/pemilihan/umumkan-hasil", { method: "POST", body: JSON.stringify({ umumkan }) });
      await refreshFasePemilihan();
    } catch (e) {
      setUmumkanError(e instanceof Error ? e.message : "Gagal mengubah status pengumuman");
    } finally {
      setUmumkanBusy(false);
    }
  }

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto space-y-6">
      <header className={role === "panitia" ? "space-y-2 pt-2" : "flex items-center justify-between pt-2"}>
        <h1 className="text-lg font-bold">Rekonsiliasi</h1>
        {role === "panitia" ? (
          <PanitiaNav active="/admin/rekonsiliasi" />
        ) : (
          <a href={role === "admin" ? "/admin/fase" : "/pengawas"} className="text-sm text-blue-600 hover:underline">Kembali</a>
        )}
      </header>

      <div className="flex gap-2">
        <button onClick={() => setMode("prod")} className={`flex-1 rounded-lg py-2 ${mode === "prod" ? "bg-slate-900 text-white" : "border"}`}>Produksi</button>
        <button onClick={() => setMode("simulasi")} className={`flex-1 rounded-lg py-2 ${mode === "simulasi" ? "bg-slate-900 text-white" : "border"}`}>Simulasi</button>
      </div>

      {isAdmin && fasePemilihan && (
        <div className="bg-white rounded-xl shadow p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Pengumuman Hasil ke Pemilih</h2>
            <span className="text-xs text-slate-400">
              Berlaku untuk fase Pemilihan yang sedang aktif saat ini -- lihat pita &quot;MODE UJI COBA&quot; di atas kalau ada.
            </span>
          </div>
          {fasePemilihan.hasil_diumumkan ? (
            <>
              <p className="text-sm text-emerald-700">Hasil SUDAH diumumkan -- dashboard pemilih menampilkan perolehan suara.</p>
              <button
                onClick={() => toggleUmumkan(false)}
                disabled={umumkanBusy}
                className="text-sm border border-red-300 text-red-600 rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                Batalkan Pengumuman
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                {fasePemilihan.status === "ditutup"
                  ? "Belum diumumkan -- pemilih masih melihat layar \"terima kasih, silakan menunggu\"."
                  : "Fase pemilihan harus ditutup dulu sebelum hasil bisa diumumkan."}
              </p>
              <button
                onClick={() => toggleUmumkan(true)}
                disabled={umumkanBusy || fasePemilihan.status !== "ditutup"}
                className="text-sm bg-emerald-600 text-white rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                Umumkan Hasil ke Pemilih
              </button>
            </>
          )}
          {umumkanError && <p className="text-red-600 text-sm">{umumkanError}</p>}
        </div>
      )}

      {data && (
        <>
          {data.perlu_investigasi && (
            <div className="bg-red-100 text-red-700 rounded-lg p-3 text-sm font-medium">
              Total sudah-memilih tidak sama dengan total suara -- PERLU INVESTIGASI sebelum hasil diumumkan.
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Token terbit" value={data.total_token_terbit} onClick={toggleDaftarToken} active={!!daftarToken} busy={daftarBusy} />
            <Stat label="Sudah memilih" value={data.total_sudah_memilih} />
            <Stat label="Scan keluar" value={data.total_scan_keluar} />
            <Stat label="Total suara" value={data.total_suara} />
          </div>

          {daftarToken && (
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <div className="p-3 border-b flex items-center justify-between">
                <p className="text-sm font-bold">Daftar Token Terbit ({daftarToken.length})</p>
                <p className="text-xs text-slate-400">Bukan pilihan suaranya -- tetap anonim sesuai desain</p>
              </div>
              {daftarToken.length === 0 ? (
                <p className="text-sm text-slate-400 p-4 text-center">Belum ada token yang terbit.</p>
              ) : (
                <div className="divide-y max-h-[28rem] overflow-y-auto">
                  {daftarToken.map((b, i) => (
                    <div key={i} className="p-3 flex items-center justify-between gap-2 text-sm">
                      <div>
                        <p className="font-medium">{b.nama} <span className="text-slate-400 font-normal">-- {b.nis_nip}</span></p>
                        <p className="text-xs text-slate-400">
                          {b.kelas_atau_pangkat} &middot; {new Date(b.antre_at).toLocaleString("id-ID")}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            b.status === "kedaluwarsa" ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {STATUS_LABEL[b.status] ?? b.status}
                        </span>
                        {b.sudah_scan_keluar && <p className="text-xs text-slate-400 mt-1">Sudah scan keluar</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl shadow divide-y">
            {data.per_paslon.map((p) => (
              <div key={p.kandidat_id} className="p-3 flex items-center justify-between">
                <span>No. {p.nomor_urut} -- {p.nama}</span>
                <span className="font-bold">{p.jumlah_suara}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  onClick,
  active,
  busy,
}: {
  label: string;
  value: number;
  onClick?: () => void;
  active?: boolean;
  busy?: boolean;
}) {
  if (!onClick) {
    return (
      <div className="bg-white rounded-xl shadow p-4 text-center">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    );
  }
  return (
    <button
      onClick={onClick}
      className={`rounded-xl shadow p-4 text-center w-full ${active ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50"}`}
    >
      <div className="text-2xl font-bold">{busy ? "..." : value}</div>
      <div className={`text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>
        {label}
        <span className={`block ${active ? "text-white" : "text-blue-600"}`}>{active ? "sembunyikan" : "lihat daftar"}</span>
      </div>
    </button>
  );
}
