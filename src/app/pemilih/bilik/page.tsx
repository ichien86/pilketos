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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("pilketos_voteToken");
    if (!t) {
      router.push("/pemilih");
      return;
    }
    setVoteToken(t);
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
        body: JSON.stringify({ kandidatId: terpilih._id }),
      });
      // voteToken TIDAK dihapus -- masih dipakai halaman bukti (US-15) untuk
      // query GET /api/vote/[token]/status, endpoint read-only yang tidak
      // pernah membuat suara baru walau dipanggil berkali-kali.
      router.push("/pemilih/bukti");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal submit, coba lagi");
      setBusy(false);
    }
  }

  if (!voteToken) return null;

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto space-y-4">
      <h1 className="text-lg font-bold pt-2">Bilik Suara</h1>

      {mode === "scan_bilik" && (
        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <p className="text-sm text-slate-600">Scan QR yang tertempel di bilik untuk memulai.</p>
          <QrScanner active onResult={handleScanBilik} />
        </div>
      )}

      {mode === "voting" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Pilih satu pasangan calon:</p>
          {kandidatList.map((k) => (
            <button
              key={k._id}
              onClick={() => {
                setTerpilih(k);
                setMode("konfirmasi");
              }}
              className="w-full text-left bg-white rounded-xl shadow p-5 hover:ring-2 hover:ring-slate-900 space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  <CandidateAvatar nama={k.nama_ketua} foto={k.foto_ketua} />
                  <CandidateAvatar nama={k.nama_wakil} foto={k.foto_wakil} />
                </div>
                <div className="font-bold text-slate-900">No. {k.nomor_urut} -- {k.nama_ketua} & {k.nama_wakil}</div>
              </div>
              {k.visi && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Visi</p>
                  <p className="text-slate-700 leading-relaxed">{k.visi}</p>
                </div>
              )}
              {k.misi && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Misi</p>
                  <MisiList misi={k.misi} className="text-slate-700 leading-relaxed" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {mode === "konfirmasi" && terpilih && (
        <div className="bg-white rounded-xl shadow p-6 space-y-4 text-center">
          <p>Anda memilih:</p>
          <div className="flex justify-center -space-x-2">
            <CandidateAvatar nama={terpilih.nama_ketua} foto={terpilih.foto_ketua} size={48} />
            <CandidateAvatar nama={terpilih.nama_wakil} foto={terpilih.foto_wakil} size={48} />
          </div>
          <p className="font-bold text-lg">No. {terpilih.nomor_urut} -- {terpilih.nama_ketua} & {terpilih.nama_wakil}</p>
          <p className="text-sm text-slate-500">Pilihan tidak bisa diubah setelah dikirim.</p>
          <div className="flex gap-2">
            <button onClick={() => setMode("voting")} className="flex-1 border rounded-lg py-2">Batal</button>
            <button onClick={submitVote} disabled={busy} className="flex-1 bg-slate-900 text-white rounded-lg py-2 disabled:opacity-50">
              {busy ? "Mengirim..." : "Kirim Suara"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}
    </main>
  );
}
