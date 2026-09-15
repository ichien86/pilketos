"use client";

import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/client-fetch";
import MisiList from "@/components/MisiList";
import LogoutButton from "@/components/LogoutButton";
import VideoSosialisasiPlayer from "@/components/VideoSosialisasiPlayer";

interface Kandidat {
  _id: string;
  nomor_urut: number;
  nama_ketua: string;
  nama_wakil: string;
  foto_ketua: string | null;
  foto_wakil: string | null;
  visi: string | null;
  misi: string | null;
}
interface Video {
  _id: string;
  kandidat_id: string;
  url: string;
}
interface Progress {
  total: number;
  sudah_ditonton: number;
  daftar: Array<{ kandidat_id: string; nomor_urut: number; nama_ketua: string; nama_wakil: string; sudah_ditonton: boolean }>;
}

// US-11 & US-12 -- tonton video kampanye setiap paslon + progress.
export default function SosialisasiPage() {
  const [kandidat, setKandidat] = useState<Kandidat[]>([]);
  const [video, setVideo] = useState<Video[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [sosialisasiAktif, setSosialisasiAktif] = useState(false);

  async function refresh() {
    try {
      const [k, v, p, fase] = await Promise.all([
        apiFetch<Kandidat[]>("/api/kandidat"),
        apiFetch<Video[]>("/api/video"),
        apiFetch<Progress>("/api/progress"),
        apiFetch<Array<{ nama_fase: string; status: string }>>("/api/fase"),
      ]);
      setKandidat(k);
      setVideo(v);
      setProgress(p);
      setSosialisasiAktif(fase.some((f) => f.nama_fase === "sosialisasi" && f.status === "aktif"));
    } catch {
      // Error auth diintersep oleh client-fetch untuk diarahkan kembali ke login
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onEnded(videoId: string) {
    await apiFetch(`/api/video/${videoId}/tonton`, { method: "POST" });
    await refresh();
  }

  // Pengurutan dinamis: Paslon yang belum ditonton otomatis diposisikan di urutan teratas
  // Jika sama-sama belum (atau sudah), diurutkan berdasarkan nomor urut paslon.
  const kandidatTerurut = useMemo(() => {
    return [...kandidat].sort((a, b) => {
      const aSudah = progress?.daftar.find((d) => d.kandidat_id === a._id)?.sudah_ditonton ?? false;
      const bSudah = progress?.daftar.find((d) => d.kandidat_id === b._id)?.sudah_ditonton ?? false;
      if (aSudah !== bSudah) {
        return aSudah ? 1 : -1; // Yang belum ditonton diprioritaskan di atas
      }
      return a.nomor_urut - b.nomor_urut;
    });
  }, [kandidat, progress]);

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto space-y-6">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-bold">Sosialisasi Kandidat</h1>
        {sosialisasiAktif ? (
          <LogoutButton />
        ) : (
          <a href="/pemilih" className="text-sm text-blue-600 hover:underline">Kembali</a>
        )}
      </header>

      {progress && (
        <div className="bg-white rounded-xl shadow p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-medium">Progress menonton: {progress.sudah_ditonton} / {progress.total}</p>
            {progress.sudah_ditonton === progress.total && progress.total > 0 && (
              <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                ✓ Lengkap
              </span>
            )}
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress.total ? (progress.sudah_ditonton / progress.total) * 100 : 0}%` }}
            />
          </div>
          {progress.sudah_ditonton > 0 && progress.sudah_ditonton < progress.total && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-2">
              💡 Video paslon berikutnya otomatis dipindahkan ke urutan teratas agar mudah dilihat dan dilanjutkan.
            </p>
          )}
        </div>
      )}

      <div className="space-y-4">
        {kandidatTerurut.map((k, idx) => {
          const v = video.find((vv) => vv.kandidat_id === k._id);
          const sudah = progress?.daftar.find((d) => d.kandidat_id === k._id)?.sudah_ditonton;
          const isBerikutnya = !sudah && idx === 0 && (progress?.sudah_ditonton ?? 0) > 0;

          return (
            <div
              key={k._id}
              className={`bg-white rounded-xl shadow p-4 space-y-2 transition-all ${
                isBerikutnya ? "ring-2 ring-amber-400 border border-amber-300" : ""
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold">No. {k.nomor_urut} -- {k.nama_ketua} & {k.nama_wakil}</h2>
                  {isBerikutnya && (
                    <span className="text-[11px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                      👉 Tonton Berikutnya
                    </span>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${sudah ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {sudah ? "✓ Sudah ditonton" : "Belum ditonton"}
                </span>
              </div>
              {v ? (
                <VideoSosialisasiPlayer
                  videoId={v._id}
                  src={v.url}
                  sudahDitonton={Boolean(sudah)}
                  onComplete={() => onEnded(v._id)}
                />
              ) : (
                <p className="text-sm text-slate-400">Video belum tersedia</p>
              )}
              {k.visi && <p className="text-sm text-slate-600"><b>Visi:</b> {k.visi}</p>}
              {k.misi && (
                <div className="text-sm text-slate-600">
                  <b>Misi:</b>
                  <MisiList misi={k.misi} className="mt-1" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
