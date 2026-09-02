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
interface BarisSuara {
  token: string;
  pilihan: string;
  waktu: string;
}

type Filter = "semua" | "sudah_memilih" | "scan_keluar" | "suara";

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
  const [daftarFull, setDaftarFull] = useState<BarisToken[] | null>(null);
  const [daftarSuara, setDaftarSuara] = useState<BarisSuara[] | null>(null);
  const [daftarFilter, setDaftarFilter] = useState<Filter | null>(null);
  const [daftarBusy, setDaftarBusy] = useState<Filter | null>(null);

  useEffect(() => {
    async function load() {
      const modeData = await apiFetch<{ aktif: boolean }>("/api/mode/uji-coba");
      const currentMode = modeData.aktif ? "simulasi" : "prod";
      setMode(currentMode);
      const rekonData = await apiFetch<Rekon>(`/api/admin/rekonsiliasi?mode=${currentMode}`);
      setData(rekonData);
      setDaftarFull(null);
      setDaftarSuara(null);
      setDaftarFilter(null);
    }
    load();
  }, []);

  async function tampilkanDaftar(filter: Filter) {
    if (daftarFilter === filter) {
      setDaftarFilter(null);
      return;
    }
    if (filter === "suara") {
      if (!daftarSuara) {
        setDaftarBusy(filter);
        try {
          const res = await apiFetch<{ daftar: BarisSuara[] }>(`/api/admin/rekonsiliasi/daftar-suara?mode=${mode}`);
          setDaftarSuara(res.daftar);
        } catch(e) {
          alert(e instanceof Error ? e.message : "Gagal memuat daftar suara");
          setDaftarBusy(null);
          return;
        } finally {
          setDaftarBusy(null);
        }
      }
    } else {
      if (!daftarFull) {
        setDaftarBusy(filter);
        try {
          const res = await apiFetch<{ daftar: BarisToken[] }>(`/api/admin/rekonsiliasi/daftar-token?mode=${mode}`);
          setDaftarFull(res.daftar);
        } finally {
          setDaftarBusy(null);
        }
      }
    }
    setDaftarFilter(filter);
  }

  const daftarTampil = (daftarFull ?? []).filter((b) => {
    if (daftarFilter === "sudah_memilih") return b.status === "sudah_memilih" || b.status === "selesai";
    if (daftarFilter === "scan_keluar") return b.sudah_scan_keluar;
    return true;
  });
  const DAFTAR_JUDUL: Record<Filter, string> = {
    semua: "Daftar Token Terbit",
    sudah_memilih: "Daftar Sudah Memilih",
    scan_keluar: "Daftar Sudah Scan Keluar",
    suara: "Daftar Rekaman Suara (Anonim)",
  };

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
            <Stat label="Token terbit" value={data.total_token_terbit} onClick={() => tampilkanDaftar("semua")} active={daftarFilter === "semua"} busy={daftarBusy === "semua"} />
            <Stat label="Sudah memilih" value={data.total_sudah_memilih} onClick={() => tampilkanDaftar("sudah_memilih")} active={daftarFilter === "sudah_memilih"} busy={daftarBusy === "sudah_memilih"} />
            <Stat label="Scan keluar" value={data.total_scan_keluar} onClick={() => tampilkanDaftar("scan_keluar")} active={daftarFilter === "scan_keluar"} busy={daftarBusy === "scan_keluar"} />
            <Stat label="Total suara" value={data.total_suara} onClick={() => tampilkanDaftar("suara")} active={daftarFilter === "suara"} busy={daftarBusy === "suara"} />
          </div>

          {daftarFilter && (
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <div className="p-3 border-b flex items-center justify-between">
                <p className="text-sm font-bold">{DAFTAR_JUDUL[daftarFilter]} ({daftarFilter === "suara" ? (daftarSuara ?? []).length : daftarTampil.length})</p>
                <p className="text-xs text-slate-400">Bukan pilihan suaranya -- tetap anonim sesuai desain</p>
              </div>
              
              {daftarFilter === "suara" ? (
                (daftarSuara ?? []).length === 0 ? (
                  <p className="text-sm text-slate-400 p-4 text-center">Belum ada data untuk ditampilkan atau belum diumumkan.</p>
                ) : (
                  <div className="divide-y max-h-[28rem] overflow-y-auto">
                    {(daftarSuara ?? []).map((b, i) => (
                      <div key={i} className="p-3 flex items-center justify-between gap-2 text-sm">
                        <div>
                          <p className="font-medium font-mono text-xs">{b.token}</p>
                          <p className="text-xs text-slate-400">
                            {new Date(b.waktu).toLocaleString("id-ID")}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold">{b.pilihan}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                daftarTampil.length === 0 ? (
                  <p className="text-sm text-slate-400 p-4 text-center">Belum ada data untuk ditampilkan.</p>
                ) : (
                  <div className="divide-y max-h-[28rem] overflow-y-auto">
                    {daftarTampil.map((b, i) => (
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
                )
              )}
            </div>
          )}

          {fasePemilihan?.hasil_diumumkan ? (
            <div className="bg-white rounded-xl shadow divide-y">
              {data.per_paslon.map((p) => (
                <div key={p.kandidat_id} className="p-3 flex items-center justify-between">
                  <span>No. {p.nomor_urut} -- {p.nama}</span>
                  <span className="font-bold">{p.jumlah_suara}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow p-4 text-center text-slate-500 text-sm">
              Perolehan suara (rekapitulasi) belum dapat dilihat sebelum hasil diumumkan ke pemilih.
            </div>
          )}
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
