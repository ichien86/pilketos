"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/client-fetch";
import QrScanner from "@/components/QrScanner";
import CandidateAvatar from "@/components/CandidateAvatar";
import MisiList from "@/components/MisiList";

interface KandidatRingkas {
  _id: string;
  nomor_urut: number;
  nama_ketua: string;
  nama_wakil: string;
  foto_ketua: string | null;
  foto_wakil: string | null;
  visi: string | null;
  misi: string | null;
}

export default function BilikPage() {
  const router = useRouter();
  const [voteToken, setVoteToken] = useState<string | null>(null);
  const [mode, setMode] = useState<"scan_bilik" | "voting" | "konfirmasi">("scan_bilik");
  const [kandidatList, setKandidatList] = useState<KandidatRingkas[]>([]);
  const [terpilih, setTerpilih] = useState<KandidatRingkas | null>(null);
  const [alasanAbstain, setAlasanAbstain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const AbstainMock: KandidatRingkas = {
    _id: "abstain",
    nomor_urut: 0, // Not really used for Abstain
    nama_ketua: "Abstain",
    nama_wakil: "Kotak Kosong",
    foto_ketua: null,
    foto_wakil: null,
    visi: null,
    misi: null,
  };

  // Mendarat di sini bisa juga lewat tombol back browser (mis. dari halaman
  // Bukti setelah selesai memilih) atau reload di tengah proses, bukan cuma
  // lewat alur normal dari dashboard -- jadi cek status sesi yang SEBENARNYA
  // dulu sebelum memutuskan mode awal, daripada asumsi selalu mulai dari
  // scan bilik. Kirim/klaim ulang tetap ditolak server kalau memang sudah
  // lewat tahap itu (lihat klaim-bilik/submit route) -- ini murni perbaikan
  // supaya tidak nyasar ke layar yang salah, bukan pengaman keamanan.
  useEffect(() => {
    const t = localStorage.getItem("pilketos_voteToken");
    if (!t) {
      router.push("/pemilih");
      return;
    }
    let cancelled = false;
    async function cekStatus() {
      try {
        const res = await apiFetch<{ status: string }>(`/api/vote/${t}/status`);
        if (cancelled) return;
        if (res.status === "sudah_memilih" || res.status === "selesai") {
          router.replace("/pemilih/bukti");
          return;
        }
        if (res.status !== "di_bilik" && res.status !== "menunggu") {
          localStorage.removeItem("pilketos_voteToken");
          router.replace("/pemilih");
          return;
        }
        setVoteToken(t);
        if (res.status === "di_bilik") {
          const list = await apiFetch<KandidatRingkas[]>(`/api/vote/${t}/kandidat`);
          if (!cancelled) {
            setKandidatList(list);
            setMode("voting");
          }
        }
      } catch {
        if (!cancelled) {
          localStorage.removeItem("pilketos_voteToken");
          router.replace("/pemilih");
        }
      }
    }
    cekStatus();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleScanBilik(qrBilikHash: string) {
    if (!voteToken || busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/vote/klaim-bilik", {
        method: "POST",
        body: JSON.stringify({ voteToken, qrBilikHash }),
      });
      const list = await apiFetch<KandidatRingkas[]>(`/api/vote/${voteToken}/kandidat`);
      setKandidatList(list);
      setMode("voting");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal klaim bilik, coba lagi");
    } finally {
      setBusy(false);
    }
  }

  async function submitVote() {
    if (!voteToken || !terpilih || busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch<{ buktiToken: string }>(`/api/vote/${voteToken}/submit`, {
        method: "POST",
        body: JSON.stringify({
          kandidatId: terpilih._id,
          alasanAbstain: terpilih._id === "abstain" ? alasanAbstain : undefined,
        }),
      });
      localStorage.removeItem("pilketos_voteToken");
      router.push("/pemilih/bukti");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal submit, coba lagi");
      setBusy(false);
    }
  }

  if (!voteToken) return null;

  // Grid kolom adaptif dinamis berdasarkan jumlah kandidat dan orientasi layar (portrait/landscape)
  const gridLayoutClass =
    kandidatList.length === 1
      ? "grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5 max-w-2xl mx-auto items-stretch"
      : kandidatList.length === 2
      ? "grid grid-cols-1 sm:grid-cols-2 landscape:grid-cols-2 gap-3.5 sm:gap-5 lg:gap-6 items-stretch"
      : kandidatList.length === 3
      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 landscape:grid-cols-3 gap-3.5 sm:gap-5 items-stretch"
      : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 landscape:grid-cols-2 lg:landscape:grid-cols-4 gap-3.5 sm:gap-5 items-stretch";

  return (
    <main className="min-h-screen p-2.5 sm:p-5 lg:p-6 w-full max-w-7xl mx-auto space-y-3 sm:space-y-4">
      {/* Header Surat Suara */}
      <div className="flex items-center justify-between pt-1 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-base sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">
            Surat Suara Digital
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500">Pilketos MAN 3 Boyolali — Bilik Suara</p>
        </div>
        {mode === "voting" && (
          <span className="text-[11px] sm:text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full shrink-0">
            {kandidatList.length} Paslon
          </span>
        )}
      </div>

      {mode === "scan_bilik" && (
        <div className="bg-white rounded-2xl shadow p-5 max-w-md mx-auto space-y-4 text-center">
          <p className="text-sm font-medium text-slate-700">
            Scan QR Code yang tertempel di dinding bilik fisik untuk membuka surat suara.
          </p>
          <div className="overflow-hidden rounded-xl">
            <QrScanner active onResult={handleScanBilik} wajibKameraBelakang />
          </div>
        </div>
      )}

      {mode === "voting" && (
        <div className="space-y-3 sm:space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-center">
            <p className="text-xs sm:text-sm font-medium text-blue-900">
              Silakan pelajari visi-misi dan ketuk paslon pilihan Anda:
            </p>
          </div>

          {/* Grid Kartu Suara Adaptif */}
          <div className={gridLayoutClass}>
            {kandidatList.map((k) => (
              <div
                key={k._id}
                onClick={() => {
                  setTerpilih(k);
                  setMode("konfirmasi");
                }}
                role="button"
                tabIndex={0}
                className="flex flex-col justify-between bg-white rounded-2xl border-2 border-slate-200 hover:border-blue-600 hover:shadow-xl active:scale-[0.99] transition-all cursor-pointer overflow-hidden group p-3.5 sm:p-5 space-y-3.5"
              >
                {/* Header Paslon & Nomor Urut */}
                <div className="space-y-2.5 sm:space-y-3">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center font-black shadow-sm shrink-0">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 -mb-1">No</span>
                      <span className="text-lg sm:text-2xl leading-none">{k.nomor_urut}</span>
                    </div>
                    <div className="flex -space-x-2.5 shrink-0 pt-0.5">
                      <div className="ring-2 ring-white rounded-full shadow-sm">
                        <CandidateAvatar nama={k.nama_ketua} foto={k.foto_ketua} size={44} />
                      </div>
                      <div className="ring-2 ring-white rounded-full shadow-sm">
                        <CandidateAvatar nama={k.nama_wakil} foto={k.foto_wakil} size={44} />
                      </div>
                    </div>
                  </div>

                  {/* Nama Kandidat */}
                  <div>
                    <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Calon Ketua &amp; Wakil
                    </p>
                    <p className="font-bold text-sm sm:text-base md:text-lg text-slate-900 group-hover:text-blue-900 transition leading-snug">
                      {k.nama_ketua} &amp; {k.nama_wakil}
                    </p>
                  </div>

                  {/* Visi */}
                  {k.visi && (
                    <div className="bg-slate-50 rounded-xl p-2.5 sm:p-3 border border-slate-100">
                      <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Visi
                      </p>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic">
                        &ldquo;{k.visi}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Misi */}
                  {k.misi && (
                    <div className="space-y-1 max-h-56 landscape:max-h-44 overflow-y-auto pr-1">
                      <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Misi
                      </p>
                      <MisiList misi={k.misi} className="text-xs sm:text-sm text-slate-700 leading-relaxed space-y-1" />
                    </div>
                  )}
                </div>

                {/* Tombol Pilih Paslon */}
                <div className="pt-2">
                  <div className="w-full bg-slate-900 group-hover:bg-blue-600 text-white font-bold text-xs sm:text-sm py-2.5 sm:py-3 rounded-xl text-center shadow transition-all flex items-center justify-center gap-1.5">
                    <span>Coblos Paslon No. {k.nomor_urut}</span>
                    <span className="text-xs opacity-80">&rarr;</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Opsi Calon Tunggal vs Kotak Kosong */}
            {kandidatList.length === 1 && (
              <div
                onClick={() => {
                  setTerpilih(AbstainMock);
                  setMode("konfirmasi");
                }}
                role="button"
                tabIndex={0}
                className="flex flex-col justify-center items-center bg-white rounded-2xl border-2 border-slate-200 hover:border-slate-800 hover:shadow-xl active:scale-[0.99] transition-all cursor-pointer overflow-hidden group p-4 sm:p-5 space-y-4 min-h-[260px]"
              >
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-slate-100 rounded-full flex items-center justify-center border-2 border-slate-300 group-hover:bg-slate-200 transition-colors">
                    <span className="text-3xl sm:text-4xl">🗳️</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Pilihan Alternatif</p>
                    <p className="font-bold text-base sm:text-xl text-slate-900 group-hover:text-blue-950 transition leading-snug">
                      Kotak Kosong (Abstain)
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Pilih ini jika Anda memutuskan untuk tidak memilih pasangan calon tunggal.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Tombol Abstain jika ada lebih dari 1 paslon */}
          {kandidatList.length > 1 && (
            <div className="flex justify-center pt-2 pb-4">
              <button
                type="button"
                onClick={() => {
                  setTerpilih(AbstainMock);
                  setMode("konfirmasi");
                }}
                className="text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors py-2 px-4 rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                <span>🗳️</span>
                <span>Pilih Abstain (Kotak Kosong)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal Konfirmasi Pilihan Adaptif */}
      {mode === "konfirmasi" && terpilih && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 max-w-lg w-full space-y-3 sm:space-y-4 text-center my-auto max-h-[92vh] overflow-y-auto">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Konfirmasi Pilihan Anda
              </span>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
                Pastikan pilihan Anda sudah benar sebelum mengirim suara.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3 sm:p-4 border border-slate-200 space-y-2.5">
              {terpilih._id === "abstain" ? (
                <>
                  <div className="w-14 h-14 mx-auto bg-slate-200 rounded-full flex items-center justify-center border-2 border-slate-300">
                    <span className="text-2xl sm:text-3xl">🗳️</span>
                  </div>
                  <div>
                    <p className="font-extrabold text-base sm:text-xl text-slate-900 leading-tight">
                      Kotak Kosong (Abstain)
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="inline-flex w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-slate-900 text-white flex-col items-center justify-center font-black shadow-sm mx-auto">
                    <span className="text-[8px] sm:text-[9px] uppercase font-bold tracking-wider text-slate-400 -mb-1">
                      No
                    </span>
                    <span className="text-xl sm:text-2xl leading-none">{terpilih.nomor_urut}</span>
                  </div>

                  <div className="flex justify-center -space-x-2.5">
                    <div className="ring-3 ring-white rounded-full shadow-sm">
                      <CandidateAvatar nama={terpilih.nama_ketua} foto={terpilih.foto_ketua} size={52} />
                    </div>
                    <div className="ring-3 ring-white rounded-full shadow-sm">
                      <CandidateAvatar nama={terpilih.nama_wakil} foto={terpilih.foto_wakil} size={52} />
                    </div>
                  </div>

                  <div>
                    <p className="font-extrabold text-base sm:text-lg text-slate-900 leading-tight">
                      {terpilih.nama_ketua} &amp; {terpilih.nama_wakil}
                    </p>
                  </div>
                </>
              )}
            </div>

            {terpilih._id === "abstain" && (
              <div className="text-left space-y-1">
                <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                  Alasan Abstain <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full border border-slate-300 rounded-xl p-2.5 sm:p-3 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  rows={2}
                  placeholder="Tuliskan alasan Anda..."
                  value={alasanAbstain}
                  onChange={(e) => setAlasanAbstain(e.target.value)}
                />
                <p className="text-[11px] text-slate-500">Alasan wajib diisi untuk menganalisis keputusan pemilih.</p>
              </div>
            )}

            <p className="text-[11px] sm:text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
              ⚠️ <strong>Perhatian:</strong> Pilihan tidak dapat diubah setelah suara dikirim ke kotak suara digital.
            </p>

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMode("voting")}
                className="flex-1 border-2 border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl py-2 sm:py-2.5 text-xs sm:text-sm transition"
              >
                Batal / Ganti
              </button>
              <button
                type="button"
                onClick={submitVote}
                disabled={busy}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl py-2 sm:py-2.5 text-xs sm:text-sm shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
              >
                {busy ? "Mengirim Suara..." : "Ya, Kirim Suara Sah"}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}
    </main>
  );
}
