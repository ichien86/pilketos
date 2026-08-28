"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client-fetch";
import DisplayQr from "@/components/DisplayQr";
import LogoutButton from "@/components/LogoutButton";
import BuktiIdentitasEditor from "@/components/BuktiIdentitasEditor";
import InfoLuberJurdilButton from "@/components/InfoLuberJurdilButton";

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

// Dashboard tunggal yang menyesuaikan diri ke tahapan yang sedang berjalan --
// pemilih tidak perlu memilih menu sendiri. Sosialisasi aktif -> alihkan ke
// materi kampanye. Pemilihan aktif -> ikuti status sesi hari-H (barcode
// identitas -> bilik -> bukti) sebagai layar kiosk murni tanpa menu lain
// (US-24). Fase lain -> tidak ada tugas. `faseAktif` di sini otomatis ikut
// mode global (produksi/uji coba, lihat resolveAppMode() di server) --
// halaman ini sendiri tidak perlu tahu sedang mode apa.
export default function PemilihHomePage() {
  const router = useRouter();
  const [faseAktif, setFaseAktif] = useState<string | null | undefined>(undefined);
  const [nama, setNama] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("belum_checkin");
  const [error, setError] = useState<string | null>(null);
  const [siapMasuk, setSiapMasuk] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    let cancelled = false;
    apiFetch<Fase[]>("/api/fase").then((all) => {
      if (cancelled) return;
      setFaseAktif(all.find((f) => f.status === "aktif")?.nama_fase ?? null);
    });
    apiFetch<{ nama: string | null }>("/api/akun/identitas").then((res) => {
      if (!cancelled) setNama(res.nama);
    });
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
    <main className="min-h-screen p-4 max-w-md mx-auto space-y-6">
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-lg font-bold">{hariH ? "Check-in Pemilih" : "Beranda Pemilih"}</h1>
          {nama && <p className="text-sm text-slate-500">Selamat datang, {nama}! Suara Anda menentukan kemajuan organisasi.</p>}
        </div>
        <nav className="flex items-center gap-3 shrink-0">
          <InfoLuberJurdilButton autoShowOnce />
          <LogoutButton />
        </nav>
      </header>

      {hariH ? (
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
                <button
                  onClick={() => setSiapMasuk(true)}
                  className="w-full bg-emerald-600 text-white rounded-lg py-2.5 font-medium"
                >
                  Masuk ke Tempat Pemungutan Suara &rarr;
                </button>
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
