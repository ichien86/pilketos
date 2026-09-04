"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/client-fetch";
import QrScanner from "@/components/QrScanner";
import PanitiaNav from "@/components/PanitiaNav";

interface ScanResult {
  nama: string;
  nis_nip?: string;
  tanggal_lahir?: string;
  jenis?: "siswa" | "guru";
  kelas_atau_pangkat: string;
  bukti_jenis: string | null;
  bukti_nomor: string | null;
  lolosSyarat: boolean;
  sudahPunyaSesiHariIni: boolean;
  pemilihId: string;
}

function formatTanggalLahir(tgl?: string): string {
  if (!tgl) return "-";
  try {
    const parts = tgl.split("-");
    if (parts.length !== 3) return tgl;
    const [y, m, d] = parts;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    const formatted = date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return `${formatted} (${tgl})`;
  } catch {
    return tgl;
  }
}

interface BilikItem {
  _id: string;
  nomor_bilik: number;
  status: "kosong" | "terisi";
}

// US-23 -- scan (langkah 1, TIDAK ubah status) lalu ACC (langkah 2, tombol terpisah).
export default function PanitiaCheckinPage() {
  const [scanning, setScanning] = useState(true);
  const [data, setData] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accSuccess, setAccSuccess] = useState(false);
  const [accVoter, setAccVoter] = useState<{ nama: string; kelas_atau_pangkat: string } | null>(null);
  const [bilikList, setBilikList] = useState<BilikItem[]>([]);
  const [busy, setBusy] = useState(false);

  // Polling pemantau status bilik saat tampilan sukses aktif
  useEffect(() => {
    if (!accSuccess) return;
    let cancelled = false;
    async function refreshBilik() {
      try {
        const res = await apiFetch<{ mode: string; bilik: BilikItem[] }>("/api/panitia/bilik-monitor");
        if (!cancelled && res.bilik) {
          setBilikList(res.bilik);
        }
      } catch {
        // Biarkan jika gagal refresh sesaat
      }
    }
    const id = setInterval(refreshBilik, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [accSuccess]);

  async function handleScan(qrPayload: string) {
    if (!scanning) return;
    setScanning(false);
    setError(null);
    try {
      const res = await apiFetch<ScanResult>("/api/panitia/checkin/scan", {
        method: "POST",
        body: JSON.stringify({ qrPayload }),
      });
      setData(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal scan");
    }
  }

  async function handleAcc() {
    if (!data || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ voteToken: string; bilik?: BilikItem[] }>("/api/panitia/checkin/acc", {
        method: "POST",
        body: JSON.stringify({ pemilihId: data.pemilihId }),
      });
      setAccVoter({ nama: data.nama, kelas_atau_pangkat: data.kelas_atau_pangkat });
      setAccSuccess(true);
      if (res.bilik && res.bilik.length > 0) {
        setBilikList(res.bilik);
      } else {
        // Ambil dari bilik-monitor jika tidak ada di response
        apiFetch<{ mode: string; bilik: BilikItem[] }>("/api/panitia/bilik-monitor")
          .then((bm) => setBilikList(bm.bilik || []))
          .catch(() => {});
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal ACC");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setData(null);
    setAccSuccess(false);
    setAccVoter(null);
    setError(null);
    setScanning(true);
  }

  return (
    <main className="min-h-screen p-4 max-w-md sm:max-w-lg mx-auto space-y-4">
      <header className="space-y-2 pt-2">
        <h1 className="text-lg font-bold">Check-in Pendaftaran</h1>
        <PanitiaNav active="/panitia/checkin" />
      </header>

      {scanning && (
        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <p className="text-sm text-slate-600">Scan barcode identitas pemilih.</p>
          <QrScanner active={scanning} onResult={handleScan} />
        </div>
      )}

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}

      {data && !accSuccess && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-5 sm:p-6 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Verifikasi Dokumen Pemilih
            </span>
            <h2 className="font-black text-xl text-slate-900 leading-tight">{data.nama}</h2>
          </div>

          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-sm space-y-2">
            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60">
              <span className="text-slate-500">{data.jenis === "guru" ? "NIP" : "NIS"}</span>
              <span className="font-bold text-slate-800 font-mono">{data.nis_nip ?? "-"}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60">
              <span className="text-slate-500">Tanggal Lahir</span>
              <span className="font-semibold text-slate-800">
                {formatTanggalLahir(data.tanggal_lahir)}
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60">
              <span className="text-slate-500">{data.jenis === "guru" ? "Pangkat/Jabatan" : "Kelas"}</span>
              <span className="font-semibold text-slate-800">{data.kelas_atau_pangkat}</span>
            </div>
            {data.bukti_jenis && (
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60">
                <span className="text-slate-500">Dokumen Fisik</span>
                <span className="font-semibold text-blue-900 text-right">
                  {data.bukti_jenis} {data.bukti_nomor ? `(${data.bukti_nomor})` : ""}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-500">Syarat Sosialisasi</span>
              <span className={`font-bold ${data.lolosSyarat ? "text-emerald-700" : "text-red-600"}`}>
                {data.lolosSyarat ? "✓ Lolos Syarat" : "✗ Belum Selesai Video"}
              </span>
            </div>
          </div>

          {data.sudahPunyaSesiHariIni && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-900 font-medium">
              ⚠️ Pemilih ini sudah memiliki sesi pemilihan hari ini!
            </div>
          )}

          <p className="text-xs text-slate-400 text-center">
            Cocokkan nama, wajah, dan tanggal lahir dengan kartu pelajar/KTP/identitas fisik sebelum menekan ACC.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              onClick={reset}
              type="button"
              className="flex-1 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl py-2.5 text-sm transition"
            >
              Batal
            </button>
            <button
              onClick={handleAcc}
              type="button"
              disabled={!data.lolosSyarat || data.sudahPunyaSesiHariIni || busy}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl py-2.5 text-sm shadow-md transition disabled:opacity-40"
            >
              {busy ? "Memproses..." : "ACC Pemilih"}
            </button>
          </div>
        </div>
      )}

      {accSuccess && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-5 sm:p-6 space-y-5 text-center">
          {/* Header Sukses */}
          <div className="space-y-1.5">
            <div className="w-13 h-13 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto text-2xl font-bold shadow-sm">
              ✓
            </div>
            <h2 className="font-extrabold text-xl text-slate-900">Pemilih Berhasil di-ACC!</h2>
            {accVoter && (
              <p className="font-semibold text-base text-slate-700">
                {accVoter.nama} <span className="text-slate-400 font-normal">({accVoter.kelas_atau_pangkat})</span>
              </p>
            )}
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-1.5 px-3 inline-block">
              ✓ Token suara sudah otomatis aktif di HP pemilih
            </p>
          </div>

          {/* Pemantau Bilik Suara Real-time */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Status Bilik Suara (Live)
              </span>
              <span className="text-[11px] text-slate-400 font-semibold">
                {bilikList.filter((b) => b.status === "kosong").length} Kosong dari {bilikList.length} Bilik
              </span>
            </div>

            {bilikList.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {bilikList.map((b) => {
                    const isKosong = b.status === "kosong";
                    return (
                      <div
                        key={b._id}
                        className={`rounded-xl p-3 text-center border-2 transition-all ${
                          isKosong
                            ? "bg-emerald-50 border-emerald-400 text-emerald-800 shadow-sm"
                            : "bg-red-50 border-red-200 text-red-700 opacity-75"
                        }`}
                      >
                        <div className="text-lg font-black leading-tight">Bilik {b.nomor_bilik}</div>
                        <div className="text-xs font-semibold mt-0.5 flex items-center justify-center gap-1">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isKosong ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                            }`}
                          />
                          <span>{isKosong ? "KOSONG" : "TERISI"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Rekomendasi Arahan Panitia */}
                {bilikList.some((b) => b.status === "kosong") ? (
                  <div className="bg-emerald-100/80 border border-emerald-300 rounded-lg p-2.5 text-xs text-emerald-950 font-medium text-center">
                    👉 Arahkan pemilih ke{" "}
                    <strong>
                      Bilik{" "}
                      {bilikList
                        .filter((b) => b.status === "kosong")
                        .map((b) => b.nomor_bilik)
                        .join(", ")}
                    </strong>
                  </div>
                ) : (
                  <div className="bg-amber-100/80 border border-amber-300 rounded-lg p-2.5 text-xs text-amber-950 font-medium text-center">
                    ⏳ Semua bilik sedang terisi, minta pemilih menunggu giliran sejenak.
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-400 italic text-center py-2">
                Memuat data bilik...
              </p>
            )}
          </div>

          {/* Tombol Panggil & Scan Pemilih Berikutnya */}
          <button
            type="button"
            onClick={reset}
            className="w-full bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-base"
          >
            <span>📷</span>
            <span>Scan Pemilih Berikutnya</span>
          </button>
        </div>
      )}
    </main>
  );
}
