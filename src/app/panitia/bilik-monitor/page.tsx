"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/client-fetch";
import PanitiaNav from "@/components/PanitiaNav";

interface Bilik {
  _id: string;
  nomor_bilik: number;
  status: "kosong" | "terisi";
  masuk_bilik_at?: string | null;
  durasi_detik?: number;
}

interface RingkasanTPS {
  total_bilik: number;
  bilik_kosong: number;
  bilik_terisi: number;
  antrean_menunggu: number;
  total_suara: number;
  total_selesai: number;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function BilikMonitorPage() {
  const [bilik, setBilik] = useState<Bilik[]>([]);
  const [ringkasan, setRingkasan] = useState<RingkasanTPS | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [isTvKiosk, setIsTvKiosk] = useState(false);
  const [confirmReset, setConfirmReset] = useState<Bilik | null>(null);
  const [resetting, setResetting] = useState(false);

  // Timer counter lokal untuk durasi real-time tiap detik
  const [localDurations, setLocalDurations] = useState<Record<string, number>>({});
  const bilikRef = useRef<Bilik[]>([]);
  bilikRef.current = bilik;

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await apiFetch<{
        mode: string;
        bilik: Bilik[];
        ringkasan: RingkasanTPS;
      }>("/api/panitia/bilik-monitor");
      setBilik(res.bilik);
      setRingkasan(res.ringkasan);
      setMode(res.mode);
      setLastUpdated(new Date());
      setError(null);

      // Sinkronisasi durasi awal dari server
      const initialDur: Record<string, number> = {};
      res.bilik.forEach((b) => {
        if (b.status === "terisi") {
          initialDur[b._id] = b.durasi_detik || 0;
        }
      });
      setLocalDurations(initialDur);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat status bilik");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // Polling data server setiap 3 detik
  useEffect(() => {
    load(true);
    const pollId = setInterval(() => load(false), 3000);
    return () => clearInterval(pollId);
  }, [load]);

  // Interval detak timer tiap 1 detik untuk stopwatch lokal yang mulus
  useEffect(() => {
    const tickId = setInterval(() => {
      setLocalDurations((prev) => {
        const next = { ...prev };
        bilikRef.current.forEach((b) => {
          if (b.status === "terisi") {
            next[b._id] = (next[b._id] || 0) + 1;
          } else {
            delete next[b._id];
          }
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(tickId);
  }, []);

  async function handleResetBilik(b: Bilik) {
    setResetting(true);
    try {
      await apiFetch(`/api/panitia/bilik-monitor/${b._id}/reset`, { method: "POST" });
      setConfirmReset(null);
      await load(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal mereset bilik");
    } finally {
      setResetting(false);
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  // =========================================================================
  // TAMPILAN 1: MODE TV KIOSK / DISPLAY PANGGUNG AULA TPS (Full Screen Kiosk)
  // =========================================================================
  if (isTvKiosk) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 flex flex-col justify-between select-none">
        {/* Header Display Kiosk */}
        <header className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping inline-block"></span>
              <span className="text-xs font-black uppercase tracking-widest text-emerald-400">
                LIVE MONITOR TPS • PILKETOS
              </span>
              {mode && (
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  {mode}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white">
              Status Bilik Pemungutan Suara
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleFullscreen}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Layar Penuh"
            >
              ⛶ Fullscreen
            </button>
            <button
              onClick={() => setIsTvKiosk(false)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600/80 hover:bg-rose-600 text-white transition"
            >
              ✕ Keluar Mode TV
            </button>
          </div>
        </header>

        {/* Ringkasan Cepat di TV Kiosk */}
        <div className="grid grid-cols-3 gap-3 my-4">
          <div className="bg-emerald-950/50 border-2 border-emerald-500/40 rounded-2xl p-4 text-center">
            <p className="text-xs uppercase font-bold text-emerald-300">Bilik Siap (Kosong)</p>
            <p className="text-3xl sm:text-5xl font-black text-emerald-400 mt-1">
              {ringkasan?.bilik_kosong ?? 0}
              <span className="text-lg font-normal text-emerald-600"> / {ringkasan?.total_bilik ?? 0}</span>
            </p>
          </div>
          <div className="bg-blue-950/50 border-2 border-blue-500/40 rounded-2xl p-4 text-center">
            <p className="text-xs uppercase font-bold text-blue-300">Bilik Sedang Digunakan</p>
            <p className="text-3xl sm:text-5xl font-black text-blue-400 mt-1">
              {ringkasan?.bilik_terisi ?? 0}
            </p>
          </div>
          <div className="bg-amber-950/50 border-2 border-amber-500/40 rounded-2xl p-4 text-center">
            <p className="text-xs uppercase font-bold text-amber-300">Antrean Menunggu</p>
            <p className="text-3xl sm:text-5xl font-black text-amber-400 mt-1">
              {ringkasan?.antrean_menunggu ?? 0}
              <span className="text-sm font-normal text-amber-500"> Orang</span>
            </p>
          </div>
        </div>

        {/* Grid Bilik Raksasa Mudah Dilihat dari Jauh */}
        <div className={`grid gap-4 sm:gap-6 my-auto ${
          bilik.length <= 2 ? "grid-cols-1 sm:grid-cols-2" :
          bilik.length === 3 ? "grid-cols-1 sm:grid-cols-3" :
          "grid-cols-2 sm:grid-cols-4"
        }`}>
          {bilik.map((b) => {
            const isKosong = b.status === "kosong";
            const dur = localDurations[b._id] || 0;
            return (
              <div
                key={b._id}
                className={`rounded-3xl p-6 sm:p-8 text-center flex flex-col justify-between border-4 shadow-2xl transition-all duration-300 ${
                  isKosong
                    ? "bg-gradient-to-b from-emerald-900/60 to-emerald-950/90 border-emerald-400 text-emerald-200 ring-4 ring-emerald-500/20"
                    : "bg-gradient-to-b from-red-900/60 to-red-950/90 border-red-500 text-red-200 ring-4 ring-red-500/20"
                }`}
              >
                <div>
                  <span className="text-xs uppercase font-black tracking-widest px-3 py-1 rounded-full bg-slate-950/60 border border-white/10 inline-block mb-2">
                    Bilik Suara
                  </span>
                  <div className="text-6xl sm:text-8xl font-black tracking-tighter">
                    {b.nomor_bilik}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 space-y-1">
                  <div className={`text-lg sm:text-2xl font-black uppercase tracking-wide ${
                    isKosong ? "text-emerald-300" : "text-red-300"
                  }`}>
                    {isKosong ? "✓ KOSONG" : "● TERISI"}
                  </div>
                  <p className="text-xs sm:text-sm font-medium opacity-90">
                    {isKosong ? "Silakan Masuk" : `Sedang Memilih (${formatDuration(dur)})`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Kiosk */}
        <footer className="flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-800">
          <span>🔒 Asas Pemilu: LUBER &amp; JURDIL</span>
          <span>Update Otomatis: {lastUpdated?.toLocaleTimeString("id-ID") || "-"}</span>
        </footer>
      </div>
    );
  }

  // =========================================================================
  // TAMPILAN 2: MODE OPERASIONAL PANITIA (Lengkap dengan Metrik & Kontrol)
  // =========================================================================
  return (
    <main className="min-h-screen p-3 sm:p-6 max-w-6xl mx-auto space-y-5 antialiased">
      {/* Header Utama Panitia */}
      <header className="space-y-2 pt-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md uppercase tracking-wider">
                Monitor Bilik TPS
              </span>
              {mode && (
                <span className="text-xs text-slate-500 font-medium">
                  Mode: <strong className="text-slate-800 uppercase">{mode}</strong>
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Pantauan Bilik Suara Digital
            </h1>
          </div>

          {/* Tombol Kontrol Kanan */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsTvKiosk(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition"
              title="Buka tampilan layar penuh untuk TV antrean TPS"
            >
              <span>📺</span>
              <span>Mode Layar TV TPS</span>
            </button>
            <button
              onClick={() => load(true)}
              disabled={loading}
              className="p-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-700 transition disabled:opacity-50 text-xs font-semibold flex items-center gap-1"
              title="Muat ulang data sekarang"
            >
              <span className={loading ? "animate-spin" : ""}>🔄</span>
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        <PanitiaNav active="/panitia/bilik-monitor" />
      </header>

      {/* Indikator Status Koneksi Real-time */}
      <div className="flex items-center justify-between bg-slate-100 px-3 py-2 rounded-xl text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-slate-800">Sinkronisasi Real-Time Aktif (setiap 3 detik)</span>
        </div>
        <span className="text-[11px] text-slate-500">
          Pembaruan Terakhir: <strong>{lastUpdated?.toLocaleTimeString("id-ID") || "-"}</strong>
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm font-medium">
          ⚠️ {error}
        </div>
      )}

      {/* 4 Kartu Metrik Throughput TPS */}
      {ringkasan && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Kartu Bilik Kosong */}
          <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-bold shrink-0">
              🟢
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Bilik Siap (Kosong)</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                {ringkasan.bilik_kosong}
                <span className="text-xs font-normal text-slate-500"> / {ringkasan.total_bilik} Bilik</span>
              </p>
            </div>
          </div>

          {/* Kartu Bilik Terisi */}
          <div className="bg-white border border-blue-200 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-2xl font-bold shrink-0">
              🔵
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Bilik Terisi</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                {ringkasan.bilik_terisi}
                <span className="text-xs font-normal text-slate-500"> Sedang Memilih</span>
              </p>
            </div>
          </div>

          {/* Kartu Antrean Menunggu */}
          <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl font-bold shrink-0">
              ⏳
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Antrean Menunggu</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                {ringkasan.antrean_menunggu}
                <span className="text-xs font-normal text-slate-500"> Pemilih di Luar</span>
              </p>
            </div>
          </div>

          {/* Kartu Total Suara Masuk */}
          <div className="bg-white border border-purple-200 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-2xl font-bold shrink-0">
              🗳️
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Total Suara Masuk</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                {ringkasan.total_suara}
                <span className="text-xs font-normal text-slate-500"> Suara Sah</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grid Kartu Status Setiap Bilik */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Daftar Bilik Fisik TPS
          </h2>
          <span className="text-xs text-slate-500">
            Kapasitas TPS: {bilik.length} Bilik
          </span>
        </div>

        <div className={`grid gap-3.5 sm:gap-4 ${
          bilik.length <= 2 ? "grid-cols-1 sm:grid-cols-2" :
          bilik.length === 3 ? "grid-cols-1 sm:grid-cols-3" :
          "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
        }`}>
          {bilik.map((b) => {
            const isKosong = b.status === "kosong";
            const dur = localDurations[b._id] || 0;

            // Logika pewarnaan peringatan durasi
            const isWarning = !isKosong && dur >= 180 && dur < 270; // 3 - 4.5 menit
            const isCritical = !isKosong && dur >= 270; // >= 4.5 menit (mendekati batas 5m)

            return (
              <div
                key={b._id}
                className={`bg-white rounded-2xl border-2 p-4 sm:p-5 flex flex-col justify-between shadow-sm transition-all duration-200 ${
                  isKosong
                    ? "border-emerald-300 hover:border-emerald-500"
                    : isCritical
                    ? "border-red-500 bg-red-50/50 shadow-red-100 ring-2 ring-red-400/30"
                    : isWarning
                    ? "border-amber-400 bg-amber-50/50 shadow-amber-100"
                    : "border-blue-400 bg-blue-50/30"
                }`}
              >
                <div>
                  {/* Header Bilik: Nomor & Badge Status */}
                  <div className="flex items-start justify-between border-b border-slate-100 pb-2.5 mb-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Bilik</p>
                      <p className="text-3xl sm:text-4xl font-black text-slate-900 leading-none">
                        {b.nomor_bilik}
                      </p>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                        isKosong
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : isCritical
                          ? "bg-red-100 text-red-800 border border-red-300 animate-pulse"
                          : isWarning
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : "bg-blue-100 text-blue-800 border border-blue-200"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        isKosong ? "bg-emerald-600" :
                        isCritical ? "bg-red-600" :
                        isWarning ? "bg-amber-600" : "bg-blue-600"
                      }`}></span>
                      {isKosong ? "Kosong" : "Terisi"}
                    </span>
                  </div>

                  {/* Keterangan Status & Timer Durasi */}
                  <div className="space-y-1.5 py-1">
                    {isKosong ? (
                      <div className="bg-emerald-50 rounded-xl p-2.5 border border-emerald-100 text-center">
                        <p className="text-xs font-bold text-emerald-800">Siap Digunakan</p>
                        <p className="text-[10px] text-emerald-600">Arahkan pemilih antrean ke bilik ini</p>
                      </div>
                    ) : (
                      <div className={`rounded-xl p-2.5 border text-center space-y-1 ${
                        isCritical ? "bg-red-100/70 border-red-200 text-red-900" :
                        isWarning ? "bg-amber-100/70 border-amber-200 text-amber-900" :
                        "bg-blue-50 border-blue-100 text-blue-900"
                      }`}>
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-xs">⏱️</span>
                          <span className="text-base sm:text-lg font-mono font-black">
                            {formatDuration(dur)}
                          </span>
                        </div>
                        <p className="text-[10px] font-medium">
                          {isCritical
                            ? "⚠️ Mendekati batas 5 menit! Periksa bilik."
                            : isWarning
                            ? "Perlu dipantau (> 3 menit)"
                            : "Pemilih sedang mencoblos"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tombol Aksi Darurat Panitia */}
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400">
                    {isKosong ? "Bilik Terbuka" : "Sesi Aktif Terkunci"}
                  </span>

                  {!isKosong && (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(b)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
                      title="Reset paksa bilik jika pemilih meninggalkan bilik atau HP mati"
                    >
                      Reset Bilik
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Modal Dialog Konfirmasi Reset Bilik Darurat */}
      {confirmReset && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-sm w-full space-y-4">
            <div className="text-center space-y-1">
              <span className="text-3xl">⚠️</span>
              <h3 className="text-base font-bold text-slate-900">
                Konfirmasi Reset Bilik {confirmReset.nomor_bilik}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tindakan ini akan <strong>memaksa bilik kembali kosong</strong> dan membatalkan sesi pemilih aktif di bilik tersebut.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 leading-normal">
              ℹ️ Gunakan tombol ini <strong>hanya jika</strong> pemilih meninggalkan bilik tanpa memilih, atau perangkat HP pemilih mati/rusak di dalam bilik.
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmReset(null)}
                disabled={resetting}
                className="flex-1 py-2 rounded-xl text-xs font-semibold border border-slate-300 hover:bg-slate-50 text-slate-700 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleResetBilik(confirmReset)}
                disabled={resetting}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md transition disabled:opacity-50"
              >
                {resetting ? "Mereset..." : "Ya, Kosongkan Bilik"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

