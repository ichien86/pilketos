"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/client-fetch";
import QrScanner from "@/components/QrScanner";
import DisplayQr from "@/components/DisplayQr";
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

// US-23 -- scan (langkah 1, TIDAK ubah status) lalu ACC (langkah 2, tombol terpisah).
export default function PanitiaCheckinPage() {
  const [scanning, setScanning] = useState(true);
  const [data, setData] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voteTokenQr, setVoteTokenQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      const res = await apiFetch<{ voteToken: string }>("/api/panitia/checkin/acc", {
        method: "POST",
        body: JSON.stringify({ pemilihId: data.pemilihId }),
      });
      setVoteTokenQr(res.voteToken);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal ACC");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setData(null);
    setVoteTokenQr(null);
    setError(null);
    setScanning(true);
  }

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto space-y-4">
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

      {data && !voteTokenQr && (
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

      {voteTokenQr && (
        <div className="bg-white rounded-xl shadow p-6 text-center space-y-3">
          <p className="font-medium">Minta pemilih scan QR ini sebagai token vote (opsional -- juga otomatis terkirim ke HP pemilih).</p>
          <DisplayQr payload={voteTokenQr} />
          <button onClick={reset} className="w-full bg-slate-900 text-white rounded-lg py-2">Pemilih Berikutnya</button>
        </div>
      )}
    </main>
  );
}
