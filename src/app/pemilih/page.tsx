"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client-fetch";
import DisplayQr from "@/components/DisplayQr";
import LogoutButton from "@/components/LogoutButton";
import BuktiIdentitasEditor from "@/components/BuktiIdentitasEditor";
import InfoLuberJurdilButton from "@/components/InfoLuberJurdilButton";
import CandidateAvatar from "@/components/CandidateAvatar";
import HasilCharts from "@/components/HasilCharts";

const STATUS_LABEL: Record<string, string> = {
  belum_checkin: "Tunjukkan barcode ini ke panitia pendaftaran untuk check-in",
  menunggu: "Sudah di-ACC panitia -- menunggu giliran bilik kosong",
  di_bilik: "Sedang di bilik -- lanjutkan ke layar pemilihan",
  sudah_memilih: "Suara Anda sudah tercatat -- tunjukkan barcode bukti ke panitia pintu keluar",
  selesai: "Selesai -- terima kasih sudah memilih",
  kedaluwarsa: "Sesi kedaluwarsa -- silakan check-in ulang lewat barcode di bawah",
};

const FASE_LABEL: Record<string, string> = {
  pendataan: "Pendataan",
  pendaftaran_calon: "Pendaftaran Calon",
  sosialisasi: "Sosialisasi",
  pemilihan: "Pemilihan (Hari-H)",
};

interface Fase {
  nama_fase: string;
  status: "belum_dibuka" | "aktif" | "ditutup";
}

interface HasilPaslon {
  kandidat_id: string;
  nomor_urut: number;
  nama_ketua: string;
  nama_wakil: string;
  foto_ketua: string | null;
  foto_wakil: string | null;
  jumlah_suara: number;
}

interface HasilRes {
  diumumkan: boolean;
  diumumkan_at?: string | null;
  total_suara?: number;
  jumlah_abstain?: number;
  per_paslon?: HasilPaslon[];
}

// Dashboard tunggal yang menyesuaikan diri ke tahapan yang sedang berjalan --
// pemilih tidak perlu memilih menu sendiri. Sosialisasi aktif -> alihkan ke
// materi kampanye. Pemilihan aktif -> ikuti status sesi hari-H (barcode
// identitas -> bilik -> bukti) sebagai layar kiosk murni tanpa menu lain
// (US-24). Fase lain -> tidak ada tugas. `faseAktif` di sini otomatis ikut
// mode global (produksi/uji coba, lihat resolveAppMode() di server) --
// halaman ini sendiri tidak perlu tahu sedang mode apa.
interface Progress {
  total: number;
  sudah_ditonton: number;
  daftar: Array<{ kandidat_id: string; nomor_urut: number; nama_ketua: string; nama_wakil: string; sudah_ditonton: boolean }>;
}

export default function PemilihHomePage() {
  const router = useRouter();
  const [faseAktif, setFaseAktif] = useState<string | null | undefined>(undefined);
  const [nama, setNama] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("belum_checkin");
  const [hasil, setHasil] = useState<HasilRes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [siapMasuk, setSiapMasuk] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval>>();

  // Polling real-time pengumuman hasil perolehan suara (tanpa harus refresh manual)
  useEffect(() => {
    let cancelled = false;
    async function checkHasil() {
      try {
        const res = await apiFetch<HasilRes>("/api/hasil");
        if (cancelled) return;
        if (res && res.diumumkan) {
          setHasil(res);
        } else {
          setHasil(null);
        }
      } catch {
        // Biarkan jika belum diumumkan
      }
    }
    checkHasil();
    const id = setInterval(checkHasil, 3000);
    function onVisible() {
      if (document.visibilityState === "visible") checkHasil();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Fase[]>("/api/fase").then((all) => {
      if (cancelled) return;
      setFaseAktif(all.find((f) => f.status === "aktif")?.nama_fase ?? null);
    });
    apiFetch<{ nama: string | null }>("/api/akun/identitas").then((res) => {
      if (!cancelled) setNama(res.nama);
    });
    apiFetch<Progress>("/api/progress").then((p) => {
      if (!cancelled) setProgress(p);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (faseAktif === "sosialisasi") router.replace("/pemilih/sosialisasi");
  }, [faseAktif, router]);

  const hariH = faseAktif === "pemilihan";

  useEffect(() => {
    if (!hariH) return;
    let cancelled = false;
    async function refreshBarcode() {
      try {
        const res = await apiFetch<{ qrPayload: string }>("/api/checkin/barcode");
        if (!cancelled) setQrPayload(res.qrPayload);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Gagal memuat barcode");
      }
    }
    refreshBarcode();
    const id = setInterval(refreshBarcode, 60000);
    // Tab/browser di-background (pindah aplikasi, kunci layar) bikin browser
    // menunda timer -- begitu kembali terlihat, refresh langsung daripada
    // menunggu tick 60 detik berikutnya, supaya barcode yang ditampilkan
    // tidak basi setelah lama tidak dilihat.
    function onVisible() {
      if (document.visibilityState === "visible") refreshBarcode();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hariH]);

  useEffect(() => {
    if (!hariH) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await apiFetch<{ status: string; voteToken: string | null }>("/api/checkin/status");
        if (cancelled) return;
        setStatus(res.status);
        if (res.voteToken) {
          localStorage.setItem("pilketos_voteToken", res.voteToken);
        }
        if (res.status === "menunggu" || res.status === "di_bilik") {
          if (localStorage.getItem("pilketos_voteToken")) {
            router.push("/pemilih/bilik");
          }
        }
        if (res.status === "sudah_memilih" || res.status === "selesai") {
          router.push("/pemilih/bukti");
        }
      } catch {
        // diamkan, coba lagi di tick berikutnya
      }
    }
    poll();
    pollingRef.current = setInterval(poll, 3000);
    function onVisible() {
      if (document.visibilityState === "visible") poll();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(pollingRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hariH]);

  if (faseAktif === undefined) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-sm text-slate-400">Memuat...</p>
      </main>
    );
  }

  return (
    <main className={`min-h-screen p-3.5 sm:p-5 mx-auto space-y-5 transition-all ${hasil?.diumumkan ? "max-w-4xl" : "max-w-md"}`}>
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-lg font-bold">
            {hasil?.diumumkan ? "Hasil Pemilihan OSIM" : hariH ? "Check-in Pemilih" : "Beranda Pemilih"}
          </h1>
          {nama && <p className="text-sm text-slate-500">Selamat datang, {nama}! Suara Anda menentukan kemajuan organisasi.</p>}
        </div>
        <nav className="flex items-center gap-3 shrink-0">
          <InfoLuberJurdilButton autoShowOnce />
          <LogoutButton />
        </nav>
      </header>

      {hasil?.diumumkan ? (
        <div className="space-y-4 sm:space-y-6">
          {/* Banner Pengumuman Resmi */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-5 sm:p-6 text-center shadow-lg space-y-2 border border-blue-700/40">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-300 bg-emerald-950/70 px-3 py-1 rounded-full border border-emerald-500/40">
              Pengumuman Resmi
            </span>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
              Hasil Pemilihan Ketua &amp; Wakil Ketua OSIM
            </h2>
            <p className="text-xs sm:text-sm text-blue-200">
              MAN 3 Boyolali — Masa Bakti 2026/2027
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs bg-white/15 px-3 py-1 rounded-full font-semibold">
                Total Suara Sah: {hasil.total_suara?.toLocaleString("id-ID") ?? 0} Suara
              </span>
              {hasil.diumumkan_at && (
                <span className="text-[11px] text-blue-200 bg-black/20 px-2.5 py-1 rounded-full">
                  Diumumkan: {new Date(hasil.diumumkan_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                </span>
              )}
            </div>
          </div>

          {/* Visualisasi Grafik Batang & Donat SVG */}
          {hasil.per_paslon && hasil.per_paslon.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
              <HasilCharts
                perPaslon={hasil.per_paslon}
                jumlahAbstain={hasil.jumlah_abstain ?? 0}
                totalSuara={hasil.total_suara ?? 0}
              />
            </div>
          )}

          {/* Rincian Perolehan Suara Paslon */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 px-1">
              Rincian Perolehan Suara
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {hasil.per_paslon?.map((p) => {
                const total = hasil.total_suara ?? 0;
                const persen = total > 0 ? ((p.jumlah_suara / total) * 100).toFixed(1) : "0.0";
                return (
                  <div
                    key={p.kandidat_id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3.5"
                  >
                    <div className="w-12 h-12 rounded-xl bg-slate-900 text-white font-black flex flex-col items-center justify-center shrink-0">
                      <span className="text-[8px] uppercase tracking-wider text-slate-400 -mb-1">No</span>
                      <span className="text-lg leading-none">{p.nomor_urut}</span>
                    </div>
                    <div className="flex -space-x-2 shrink-0">
                      <div className="ring-2 ring-white rounded-full">
                        <CandidateAvatar nama={p.nama_ketua} foto={p.foto_ketua} size={40} />
                      </div>
                      <div className="ring-2 ring-white rounded-full">
                        <CandidateAvatar nama={p.nama_wakil} foto={p.foto_wakil} size={40} />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-slate-900 truncate">
                        {p.nama_ketua} &amp; {p.nama_wakil}
                      </p>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-sm font-black text-blue-600">{p.jumlah_suara} Suara</span>
                        <span className="text-xs text-slate-400 font-medium">({persen}%)</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Suara Abstain jika ada */}
              {typeof hasil.jumlah_abstain === "number" && hasil.jumlah_abstain > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-slate-200 text-slate-600 font-black flex items-center justify-center shrink-0 text-xl">
                    🗳️
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-slate-900">Abstain / Suara Kosong</p>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-sm font-black text-slate-600">{hasil.jumlah_abstain} Suara</span>
                      <span className="text-xs text-slate-400 font-medium">
                        ({hasil.total_suara ? ((hasil.jumlah_abstain / hasil.total_suara) * 100).toFixed(1) : "0.0"}%)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : hariH ? (
        <>
          {status === "belum_checkin" || status === "kedaluwarsa" ? (
            siapMasuk ? (
              <div className="bg-white rounded-xl shadow p-6 text-center space-y-3">
                <p className="text-sm text-slate-500">{STATUS_LABEL[status] ?? status}</p>
                {qrPayload && (
                  <>
                    <DisplayQr payload={qrPayload} />
                    <p className="text-xs text-slate-400">Barcode berganti otomatis tiap 60 detik</p>
                    <p className="text-xs text-amber-600">Jangan screenshot atau bagikan barcode ini ke orang lain.</p>
                  </>
                )}
                {error && <p className="text-red-600 text-sm">{error}</p>}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow p-6 text-center space-y-4">
                <div>
                  <p className="text-lg font-bold text-slate-800">Saatnya Memilih!</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Datang ke Tempat Pemungutan Suara (TPS) sekarang untuk menggunakan hak pilih Anda.
                  </p>
                </div>
                <BuktiIdentitasEditor />
                {progress && progress.total > 0 && progress.sudah_ditonton < progress.total ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-amber-900">Belum Memenuhi Syarat Memilih</p>
                      <span className="text-xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-semibold">
                        {progress.sudah_ditonton} / {progress.total} Video
                      </span>
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Anda belum dapat masuk ke antrean TPS karena belum menonton seluruh video profil & visi-misi paslon. Silakan selesaikan tontonan video terlebih dahulu:
                    </p>
                    <a
                      href="/pemilih/sosialisasi"
                      className="block text-center text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 py-2.5 rounded-lg shadow-sm transition"
                    >
                      Tonton Video Sosialisasi Sekarang &rarr;
                    </a>
                  </div>
                ) : (
                  progress && progress.total > 0 && (
                    <div className="text-center pt-1">
                      <a href="/pemilih/sosialisasi" className="text-xs text-blue-600 hover:underline">
                        Lihat Ulang Profil & Video Sosialisasi Paslon &rarr;
                      </a>
                    </div>
                  )
                )}

                {(() => {
                  const belumLolos = progress && progress.total > 0 && progress.sudah_ditonton < progress.total;
                  return (
                    <div className="space-y-1">
                      <button
                        onClick={() => setSiapMasuk(true)}
                        disabled={!!belumLolos}
                        className={`w-full rounded-lg py-2.5 font-medium shadow-sm transition ${
                          belumLolos
                            ? "bg-slate-300 text-slate-500 cursor-not-allowed opacity-60"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                        }`}
                      >
                        Masuk ke Tempat Pemungutan Suara &rarr;
                      </button>
                      {belumLolos && (
                        <p className="text-xs text-slate-400 text-center">
                          (Tombol aktif setelah semua video sosialisasi selesai ditonton)
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )
          ) : (
            <div className="bg-white rounded-xl shadow p-6 text-center space-y-3">
              <p className="text-sm text-slate-500">{STATUS_LABEL[status] ?? status}</p>
              {error && <p className="text-red-600 text-sm">{error}</p>}
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl shadow p-6 text-center space-y-2">
          <p className="text-slate-700 font-medium">Belum ada yang perlu dilakukan saat ini.</p>
          <p className="text-sm text-slate-500">
            {faseAktif ? `Tahap saat ini: ${FASE_LABEL[faseAktif] ?? faseAktif}.` : "Menunggu panitia membuka tahap berikutnya."}
          </p>
        </div>
      )}
    </main>
  );
}
