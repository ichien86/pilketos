"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/client-fetch";
import QrScanner from "@/components/QrScanner";
import PanitiaNav from "@/components/PanitiaNav";

interface ScanResult {
  nama: string;
  kelas_atau_pangkat: string;
  bukti_jenis: string | null;
  bukti_nomor: string | null;
  lolosSyarat: boolean;
  sudahPunyaSesiHariIni: boolean;
  pemilihId: string;
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
        <div className="bg-white rounded-xl shadow p-6 space-y-3">
          <h2 className="font-bold text-lg">{data.nama}</h2>
          <p className="text-slate-600">{data.kelas_atau_pangkat}</p>
          <p className={data.lolosSyarat ? "text-emerald-600" : "text-red-600"}>
            {data.lolosSyarat ? "Memenuhi syarat" : "BELUM memenuhi syarat"}
          </p>
          {data.sudahPunyaSesiHariIni && <p className="text-amber-600">Sudah punya sesi hari ini!</p>}
          {data.bukti_jenis && (
            <p className="text-sm text-slate-600">
              Bukti diri yang dijanjikan: <strong>{data.bukti_jenis}</strong> No. <strong>{data.bukti_nomor}</strong>
            </p>
          )}
          <p className="text-xs text-slate-400">Cocokkan wajah/dokumen fisik pemilih sebelum menekan ACC.</p>
          <div className="flex gap-2 pt-2">
            <button onClick={reset} className="flex-1 border rounded-lg py-2">Batal</button>
            <button
              onClick={handleAcc}
              disabled={!data.lolosSyarat || data.sudahPunyaSesiHariIni || busy}
              className="flex-1 bg-emerald-600 text-white rounded-lg py-2 disabled:opacity-40"
            >
              {busy ? "Memproses..." : "ACC"}
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
