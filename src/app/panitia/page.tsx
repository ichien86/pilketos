"use client";

import { useEffect, useState } from "react";
import PanitiaNav from "@/components/PanitiaNav";
import { apiFetch } from "@/lib/client-fetch";

interface FaseItem {
  nama_fase: string;
  status: "belum_dibuka" | "aktif" | "ditutup";
  dibuka_at: string | null;
  ditutup_at: string | null;
  hasil_diumumkan?: boolean;
}

const FASE_META: Record<
  string,
  { no: number; label: string; ringkasan: string; icon: string }
> = {
  pendataan: {
    no: 1,
    label: "Pendataan DPT",
    ringkasan: "Verifikasi data siswa & guru",
    icon: "📋",
  },
  pendaftaran_calon: {
    no: 2,
    label: "Pendaftaran Calon",
    ringkasan: "Data paslon, foto, & video",
    icon: "👥",
  },
  sosialisasi: {
    no: 3,
    label: "Sosialisasi & Kampanye",
    ringkasan: "Syarat tonton video kampanye",
    icon: "📢",
  },
  pemilihan: {
    no: 4,
    label: "Pemilihan (Hari-H)",
    ringkasan: "Check-in, bilik suara, & bukti",
    icon: "🗳️",
  },
};

function formatWaktuIndo(iso: string | null): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " WIB"
    );
  } catch {
    return iso;
  }
}

// Beranda panitia pemilihan -- mengelola data DPT/kandidat/bilik (persiapan)
// + alat hari-H (check-in, pantauan bilik, scan keluar). Admin sengaja tidak
// lagi menonjolkan menu-menu ini di /admin/fase supaya fokus ke kontrol
// fase & manajemen akun panitia/pengawas saja.
// + alat hari-H (check-in, pantauan bilik, scan keluar) serta menampilkan
// jadwal & tahapan yang sedang aktif secara real-time.
export default function PanitiaHomePage() {
  const [faseList, setFaseList] = useState<FaseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadFase() {
      try {
        const res = await apiFetch<FaseItem[]>("/api/fase");
        if (!cancelled) {
          setFaseList(res);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    loadFase();
    const id = setInterval(loadFase, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const faseAktif = faseList.find((f) => f.status === "aktif");

  return (
    <main className="min-h-screen p-4 max-w-3xl mx-auto space-y-6">
      <header className="space-y-2 pt-2">
        <h1 className="text-xl font-black text-slate-900">Panel Panitia Pemilihan</h1>
        <PanitiaNav active="/panitia" />
      </header>

      {/* Kartu Status Jadwal & Tahapan Pemilihan yang Aktif */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Informasi Agenda Pemilihan
            </span>
            <h2 className="text-lg font-bold text-slate-900">Status Jadwal &amp; Tahapan</h2>
          </div>

          {loading ? (
            <span className="text-xs text-slate-400">Memuat status jadwal...</span>
          ) : faseAktif ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-300 text-emerald-800 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>
                Sedang Berlangsung: {FASE_META[faseAktif.nama_fase]?.label ?? faseAktif.nama_fase}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              <span>Tidak Ada Jadwal yang Aktif</span>
            </div>
          )}
        </div>

        {/* Timeline Visual 4 Tahapan */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {["pendataan", "pendaftaran_calon", "sosialisasi", "pemilihan"].map((key) => {
            const f = faseList.find((item) => item.nama_fase === key);
            const meta = FASE_META[key];
            const isAktif = f?.status === "aktif";
            const isDitutup = f?.status === "ditutup";

            return (
              <div
                key={key}
                className={`rounded-xl p-3 border transition-all ${
                  isAktif
                    ? "bg-emerald-50/80 border-emerald-400 text-emerald-950 shadow-sm ring-2 ring-emerald-400/30"
                    : isDitutup
                    ? "bg-slate-50 border-slate-200 text-slate-600 opacity-80"
                    : "bg-white border-slate-100 text-slate-400"
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-mono font-bold text-[11px] text-slate-400">0{meta.no}</span>
                  <span className="text-base">{meta.icon}</span>
                </div>
                <p className={`font-bold text-xs leading-snug ${isAktif ? "text-emerald-900" : ""}`}>
                  {meta.label}
                </p>
                <p className="text-[10px] mt-0.5 leading-tight opacity-75">{meta.ringkasan}</p>

                <div className="mt-2.5 pt-1.5 border-t border-slate-200/50 flex items-center gap-1 text-[10px] font-semibold">
                  {isAktif ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping"></span>
                      AKTIF
                    </span>
                  ) : isDitutup ? (
                    <span className="text-slate-500">✓ Selesai</span>
                  ) : (
                    <span className="text-slate-400">Belum Dibuka</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Arahan Tugas Panitia Berdasarkan Jadwal Aktif */}
        {faseAktif && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-1 text-slate-500">
              <span className="font-semibold text-slate-700">
                📌 Arahan Tugas Panitia ({FASE_META[faseAktif.nama_fase]?.label}):
              </span>
              {faseAktif.dibuka_at && (
                <span className="text-[11px]">
                  Dibuka sejak: <strong>{formatWaktuIndo(faseAktif.dibuka_at)}</strong>
                </span>
              )}
            </div>

            {faseAktif.nama_fase === "pemilihan" ? (
              <div className="space-y-2">
                <p className="text-slate-700 leading-relaxed">
                  Hari-H pemungutan suara sedang berlangsung. Pastikan petugas berada di pos masing-masing:
                  meja check-in identitas, pengawasan bilik suara, dan meja scan bukti keluar TPS.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href="/panitia/checkin"
                    className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs shadow-sm transition"
                  >
                    <span>📷</span> Check-in Pemilih &rarr;
                  </a>
                  <a
                    href="/panitia/bilik-monitor"
                    className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-1.5 px-3 rounded-lg text-xs shadow-sm transition"
                  >
                    <span>🖥️</span> Pantauan Bilik &rarr;
                  </a>
                  <a
                    href="/panitia/exit-scan"
                    className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs shadow-sm transition"
                  >
                    <span>🚪</span> Scan Keluar &rarr;
                  </a>
                </div>
              </div>
            ) : faseAktif.nama_fase === "sosialisasi" ? (
              <div className="space-y-2">
                <p className="text-slate-700 leading-relaxed">
                  Pemilih sedang mempelajari profil kandidat dan menonton video visi-misi untuk memenuhi syarat memilih.
                  Pantau jumlah pemilih yang telah tuntas menonton video di menu DPT.
                </p>
                <div className="pt-1">
                  <a
                    href="/admin/dpt"
                    className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-1.5 px-3 rounded-lg text-xs shadow-sm transition"
                  >
                    <span>📋</span> Pantau Pemenuhan Syarat di DPT &rarr;
                  </a>
                </div>
              </div>
            ) : faseAktif.nama_fase === "pendaftaran_calon" ? (
              <div className="space-y-2">
                <p className="text-slate-700 leading-relaxed">
                  Pendaftaran kandidat dibuka. Verifikasi pasangan calon, pastikan foto resmi terpasang, dan paslon telah mengunggah video profil.
                </p>
                <div className="pt-1">
                  <a
                    href="/admin/kandidat"
                    className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-1.5 px-3 rounded-lg text-xs shadow-sm transition"
                  >
                    <span>👥</span> Buka Manajemen Kandidat &rarr;
                  </a>
                </div>
              </div>
            ) : faseAktif.nama_fase === "pendataan" ? (
              <div className="space-y-2">
                <p className="text-slate-700 leading-relaxed">
                  Pendataan DPT sedang aktif. Lakukan import data siswa dan guru dari format Excel, serta verifikasi kebenaran data identitas pemilih.
                </p>
                <div className="pt-1">
                  <a
                    href="/admin/dpt"
                    className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-1.5 px-3 rounded-lg text-xs shadow-sm transition"
                  >
                    <span>📥</span> Kelola Data DPT &rarr;
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {/* Menu Persiapan */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
          Menu Persiapan &amp; Data
        </h2>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100">
          <NavItem
            href="/admin/dpt"
            label="Data Pemilih Tetap (DPT)"
            desc="Import Excel, tambah/edit/hapus pemilih, reset password"
          />
          <NavItem
            href="/admin/kandidat"
            label="Kandidat"
            desc="Daftar paslon, foto, publish/batalkan, akun paslon"
          />
          <NavItem
            href="/admin/bilik"
            label="Bilik Suara"
            desc="Konfigurasi jumlah bilik & cetak QR bilik fisik"
          />
        </div>
      </section>

      {/* Menu Operasional Hari-H */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
          Menu Operasional Hari-H
        </h2>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100">
          <NavItem
            href="/panitia/checkin"
            label="Check-in Pemilih"
            desc="Scan identitas & ACC pemilih masuk bilik"
          />
          <NavItem
            href="/panitia/bilik-monitor"
            label="Pantauan Bilik"
            desc="Status kosong/terisi real-time, timer durasi, & mode Kiosk"
          />
          <NavItem
            href="/panitia/exit-scan"
            label="Scan Keluar"
            desc="Validasi barcode bukti sudah memilih"
          />
          <NavItem
            href="/admin/rekonsiliasi"
            label="Rekonsiliasi"
            desc="Rekap agregat token, suara sah, dan audit status"
          />
        </div>
      </section>
    </main>
  );
}

function NavItem({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <a href={href} className="block p-4 hover:bg-slate-50 transition group">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm text-slate-900 group-hover:text-blue-600 transition">
          {label}
        </p>
        <span className="text-xs text-slate-300 group-hover:text-blue-500 transition">&rarr;</span>
      </div>
      <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
    </a>
  );
}
