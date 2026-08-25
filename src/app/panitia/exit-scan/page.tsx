"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/client-fetch";
import QrScanner from "@/components/QrScanner";
import PanitiaNav from "@/components/PanitiaNav";

// US-16 -- scan barcode bukti di meja keluar, sekali pakai.
export default function ExitScanPage() {
  const [scanning, setScanning] = useState(true);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleScan(buktiToken: string) {
    if (!scanning) return;
    setScanning(false);
    try {
      await apiFetch("/api/panitia/exit-scan", {
        method: "POST",
        body: JSON.stringify({ buktiToken }),
      });
      setMessage({ ok: true, text: "Berhasil -- pemilih boleh keluar." });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof ApiError ? e.message : "Gagal scan" });
    }
  }

  function next() {
    setMessage(null);
    setScanning(true);
  }

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto space-y-4">
      <header className="space-y-2 pt-2">
        <h1 className="text-lg font-bold">Scan Bukti Pintu Keluar</h1>
        <PanitiaNav active="/panitia/exit-scan" />
      </header>
      {scanning && (
        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <QrScanner active={scanning} onResult={handleScan} />
        </div>
      )}
      {message && (
        <div className={`rounded-xl shadow p-6 text-center space-y-3 ${message.ok ? "bg-emerald-50" : "bg-red-50"}`}>
          <p className={message.ok ? "text-emerald-700 font-medium" : "text-red-700 font-medium"}>{message.text}</p>
          <button onClick={next} className="w-full bg-slate-900 text-white rounded-lg py-2">Scan Berikutnya</button>
        </div>
      )}
    </main>
  );
}
