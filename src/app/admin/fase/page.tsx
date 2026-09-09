"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/client-fetch";
import LogoutButton from "@/components/LogoutButton";

interface Fase {
  nama_fase: string;
  status: "belum_dibuka" | "aktif" | "ditutup";
  dibuka_at: string | null;
  ditutup_at: string | null;
}

interface StatusReset {
  siap_reset: boolean;
  uji_coba_aktif: boolean;
  pemilihan_ditutup: boolean;
  hasil_diumumkan: boolean;
}

const NAMA_LABEL: Record<string, string> = {
  pendataan: "Pendataan",
  pendaftaran_calon: "Pendaftaran Calon",
  sosialisasi: "Sosialisasi",
  pemilihan: "Pemilihan (Hari-H)",
};

// US-18 (kontrol fase) + mode uji coba + reset pemilihan periode baru.
export default function AdminFasePage() {
  const [fase, setFase] = useState<Fase[]>([]);
  const [ujiCobaAktif, setUjiCobaAktif] = useState(false);
  const [statusReset, setStatusReset] = useState<StatusReset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [busyMode, setBusyMode] = useState(false);

  // Modal State untuk Reset Pemilihan Periode Baru
  const [showResetModal, setShowResetModal] = useState(false);
  const [konfirmasiText, setKonfirmasiText] = useState("");
  const [busyReset, setBusyReset] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [f, m, r] = await Promise.all([
        apiFetch<Fase[]>("/api/fase"),
        apiFetch<{ aktif: boolean }>("/api/mode/uji-coba"),
        apiFetch<StatusReset>("/api/admin/reset-pemilihan").catch(() => null),
      ]);
      setFase(f);
      setUjiCobaAktif(m.aktif);
      if (r) setStatusReset(r);
    } catch {
      // Abaikan error jaringan sesaat
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function toggleUjiCoba(aktif: boolean) {
    if (!aktif) {
      if (
        !confirm(
          "Matikan mode uji coba? SEMUA data uji coba (DPT, kandidat, video, status kelima fase, checklist, dst) akan dihapus total dan tidak bisa dikembalikan."
        )
      ) {
        return;
      }
    }
    setBusyMode(true);
    setError(null);
    try {
      await apiFetch("/api/mode/uji-coba", { method: "POST", body: JSON.stringify({ aktif }) });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengubah mode");
    } finally {
      setBusyMode(false);
    }
  }

  async function buka(nama: string, force = false) {
    setError(null);
    try {
      await apiFetch(`/api/fase/${nama}/buka`, { method: "POST", body: JSON.stringify({ force }) });
      await refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && !force) {
        if (confirm(`${e.message}\n\nKonfirmasi sekali lagi: buka ulang fase ini sebagai skenario darurat?`)) {
          if (confirm("Yakin sekali lagi? Tindakan ini tidak biasa dan sebaiknya dihindari kecuali darurat.")) {
            return buka(nama, true);
          }
        }
        return;
      }
      setError(e instanceof Error ? e.message : "Gagal membuka fase");
    }
  }

  async function tutup(nama: string) {
    setError(null);
    try {
      await apiFetch(`/api/fase/${nama}/tutup`, { method: "POST" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menutup fase");
    }
  }

  async function eksekusiReset() {
    if (konfirmasiText !== "RESET-PEMILIHAN") return;
    setBusyReset(true);
    setModalError(null);
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>("/api/admin/reset-pemilihan", {
        method: "POST",
        body: JSON.stringify({ konfirmasi: konfirmasiText }),
      });
      setShowResetModal(false);
      setKonfirmasiText("");
      setSuccessMsg(`✓ ${res.message}`);
      await refresh();
    } catch (e) {
      setModalError(e instanceof ApiError ? e.message : "Gagal mereset data pemilihan");
    } finally {
      setBusyReset(false);
    }
  }

  return (
    <main className="min-h-screen p-4 max-w-3xl mx-auto space-y-6">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-bold">Kontrol Fase</h1>
        <nav className="flex gap-3 text-sm text-blue-600">
          <a href="/admin/panitia" className="hover:underline">Panitia</a>
          <a href="/admin/rekonsiliasi" className="hover:underline">Rekonsiliasi</a>
          <LogoutButton />
        </nav>
      </header>

      <p className="text-xs text-slate-400">
        Pengelolaan DPT, kandidat, bilik, dan checklist Go/No-Go sudah dipindah ke panel panitia pemilihan (mereka login dengan akun panitia, bukan admin).
      </p>

      {/* Pesan Sukses */}
      {successMsg && (
        <div className="bg-emerald-50 border-2 border-emerald-500 text-emerald-950 p-4 rounded-xl text-sm font-medium shadow-sm flex items-start justify-between gap-3">
          <p className="text-xs text-emerald-800 leading-relaxed font-semibold">{successMsg}</p>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-800 hover:text-emerald-950 text-xs px-2 py-1 rounded bg-emerald-100 hover:bg-emerald-200 font-bold shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Pesan Error */}
      {error && (
        <div className="bg-red-50 border-2 border-red-500 text-red-950 p-4 rounded-xl text-sm font-medium shadow-sm flex items-start justify-between gap-3">
          <p className="text-xs text-red-800 leading-relaxed">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-800 hover:text-red-950 text-xs px-2 py-1 rounded bg-red-100 hover:bg-red-200 font-bold shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Mode Uji Coba */}
      <div className={`rounded-xl shadow p-4 space-y-2 ${ujiCobaAktif ? "bg-amber-50" : "bg-white"}`}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Mode Uji Coba</h2>
          <span className={`text-xs px-2 py-1 rounded-full font-mono ${ujiCobaAktif ? "bg-amber-400 text-amber-950" : "bg-slate-100 text-slate-500"}`}>
            {ujiCobaAktif ? "aktif" : "nonaktif"}
          </span>
        </div>
        <p className="text-sm text-slate-500">
          Bukan fase tersendiri -- ini flag yang menentukan apakah kelima fase di bawah (dan DPT/kandidat/sosialisasi/hari-H
          di dalamnya) sedang dijalankan untuk uji coba atau produksi sungguhan. Alurnya tetap sama persis, tetap harus
          dibuka berurutan dari Pendataan -- cuma datanya (termasuk status kelima fase itu sendiri) hidup di database
          terpisah selama mode ini aktif, dan hilang total begitu dimatikan.
        </p>
        <button
          onClick={() => toggleUjiCoba(!ujiCobaAktif)}
          disabled={busyMode}
          className={`text-sm rounded-lg px-3 py-1.5 text-white disabled:opacity-50 ${ujiCobaAktif ? "bg-red-600" : "bg-emerald-600"}`}
        >
          {ujiCobaAktif ? "Matikan Mode Uji Coba (reset semua data uji coba)" : "Aktifkan Mode Uji Coba"}
        </button>
      </div>

      {/* Daftar Fase */}
      <div className="space-y-3">
        {fase.map((f) => (
          <div key={f.nama_fase} className="bg-white rounded-xl shadow p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{NAMA_LABEL[f.nama_fase] ?? f.nama_fase}</p>
              <p className="text-xs text-slate-500">
                status: <span className="font-mono">{f.status}</span>
              </p>
            </div>
            <div className="flex gap-2">
              {f.status !== "aktif" && (
                <button onClick={() => buka(f.nama_fase)} className="text-sm bg-emerald-600 text-white rounded-lg px-3 py-1.5">
                  Buka
                </button>
              )}
              {f.status === "aktif" && (
                <button onClick={() => tutup(f.nama_fase)} className="text-sm bg-red-600 text-white rounded-lg px-3 py-1.5">
                  Tutup
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Persiapan Periode Pemilihan Baru (Reset Data Produksi) */}
      <div className="bg-white rounded-xl shadow p-5 space-y-4 border border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔄</span>
            <h2 className="font-bold text-slate-900 text-base">Persiapan Periode Pemilihan Baru</h2>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
              statusReset?.siap_reset
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                : "bg-slate-100 text-slate-600 border border-slate-300"
            }`}
          >
            {statusReset?.siap_reset ? "✓ Siap Direset" : "🔒 Terkunci"}
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Fitur ini digunakan untuk <strong>membersihkan seluruh data pemilihan periode saat ini</strong> (DPT lama, suara, paslon, video, bilik) agar aplikasi dapat dipakai kembali untuk periode pemilihan kepengurusan baru di masa mendatang.
        </p>

        {/* Syarat Validasi Pengaman */}
        <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200 text-xs">
          <p className="font-semibold text-slate-700">Syarat Keamanan untuk Reset Periode:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200">
              <span className={statusReset?.pemilihan_ditutup ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>
                {statusReset?.pemilihan_ditutup ? "✓" : "✕"}
              </span>
              <span className="text-slate-700 text-[11px]">
                Pemilihan Ditutup: <strong>{statusReset?.pemilihan_ditutup ? "Selesai" : "Belum"}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200">
              <span className={statusReset?.hasil_diumumkan ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>
                {statusReset?.hasil_diumumkan ? "✓" : "✕"}
              </span>
              <span className="text-slate-700 text-[11px]">
                Hasil Diumumkan: <strong>{statusReset?.hasil_diumumkan ? "Sudah" : "Belum"}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200">
              <span className={!statusReset?.uji_coba_aktif ? "text-emerald-600 font-bold" : "text-amber-500 font-bold"}>
                {!statusReset?.uji_coba_aktif ? "✓" : "⚠️"}
              </span>
              <span className="text-slate-700 text-[11px]">
                Mode Uji Coba: <strong>{!statusReset?.uji_coba_aktif ? "Nonaktif" : "Aktif"}</strong>
              </span>
            </div>
          </div>
        </div>

        {!statusReset?.siap_reset ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 space-y-1">
            <p className="font-semibold">🔒 Fitur Reset Terkunci</p>
            <p className="text-[11px] leading-relaxed">
              Data pemilihan periode saat ini dilindungi dan <strong>tidak dapat direset</strong> sebelum seluruh tahapan pemilihan selesai dan hasil pemungutan suara resmi diumumkan ke pemilih via menu <a href="/admin/rekonsiliasi" className="text-blue-600 underline font-semibold">Rekonsiliasi</a>.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-3 text-xs text-emerald-950 space-y-1">
              <p className="font-semibold">✅ Seluruh Rangkaian Pemilihan Selesai</p>
              <p className="text-[11px] leading-relaxed">
                Pemilihan telah ditutup dan hasil suara telah resmi diumumkan. Anda dapat mereset data untuk menyambut periode pemilihan baru kapan saja Anda siap.
              </p>
            </div>
            <button
              onClick={() => {
                setKonfirmasiText("");
                setModalError(null);
                setShowResetModal(true);
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg px-4 py-2.5 text-xs transition flex items-center gap-2 shadow-sm"
            >
              <span>⚠️</span>
              <span>Reset Data Pemilihan (Persiapan Periode Baru)</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal Dialog Konfirmasi Reset Periode Baru */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 border-b pb-3">
              <span className="text-2xl">⚠️</span>
              <h3 className="font-bold text-base text-slate-900">Konfirmasi Reset Pemilihan Periode Baru</h3>
            </div>

            <div className="text-xs text-slate-600 space-y-2.5">
              <p className="font-medium text-slate-800 leading-relaxed">
                Tindakan ini akan <strong>menghapus seluruh data pemilihan periode ini secara permanen</strong> dan mengembalikan sistem ke kondisi awal.
              </p>

              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 border border-slate-200">
                <p className="font-semibold text-slate-700">Rincian Tindakan:</p>
                <ul className="space-y-1 text-[11px]">
                  <li className="text-red-700 flex items-start gap-1.5">
                    <span>🗑️</span>
                    <span><strong>Dihapus Permanen:</strong> Seluruh DPT, akun pemilih, akun paslon, data paslon &amp; foto di server, video kampanye di server, bilik, serta seluruh rekaman suara.</span>
                  </li>
                  <li className="text-emerald-700 flex items-start gap-1.5">
                    <span>🔒</span>
                    <span><strong>Tetap Aman:</strong> Akun staf (Admin, Panitia, Pengawas) tetap dipertahankan sehingga Anda tidak kehilangan akses masuk.</span>
                  </li>
                  <li className="text-blue-700 flex items-start gap-1.5">
                    <span>🔄</span>
                    <span><strong>Status Fase:</strong> Seluruh 4 fase (Pendataan s.d. Pemilihan) akan diatur ulang ke status <code>belum_dibuka</code>.</span>
                  </li>
                </ul>
              </div>

              {modalError && (
                <div className="bg-red-50 border border-red-300 text-red-800 p-2.5 rounded-lg text-xs font-medium">
                  {modalError}
                </div>
              )}

              <div className="space-y-1.5 pt-1">
                <label className="block font-semibold text-slate-700">
                  Untuk mengonfirmasi, ketik teks <span className="font-mono text-red-600 bg-red-50 px-1 py-0.5 rounded border border-red-200">RESET-PEMILIHAN</span> di bawah ini:
                </label>
                <input
                  type="text"
                  value={konfirmasiText}
                  onChange={(e) => setKonfirmasiText(e.target.value)}
                  placeholder="RESET-PEMILIHAN"
                  disabled={busyReset}
                  className="w-full border rounded-lg px-3 py-2 text-xs font-mono tracking-wider focus:outline-hidden focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={busyReset}
                className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 font-medium rounded-lg hover:bg-slate-100 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={eksekusiReset}
                disabled={konfirmasiText !== "RESET-PEMILIHAN" || busyReset}
                className="px-4 py-2 text-xs bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm"
              >
                {busyReset ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0"></span>
                    <span>Sedang Mereset Data...</span>
                  </>
                ) : (
                  "Saya Mengerti, Reset Data Sekarang"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
