"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client-fetch";
import DisplayQr from "@/components/DisplayQr";
import CandidateAvatar from "@/components/CandidateAvatar";
import LogoutButton from "@/components/LogoutButton";

interface StatusRes {
  status: string;
  buktiQrPayload: string | null;
  buktiSudahDiscan: boolean;
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
  total_suara?: number;
  jumlah_abstain?: number;
  per_paslon?: HasilPaslon[];
}
import HasilCharts from "@/components/HasilCharts";

export default function BuktiPage() {
  const router = useRouter();
  const [data, setData] = useState<StatusRes | null>(null);
  const [hasil, setHasil] = useState<HasilRes | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await apiFetch<StatusRes>("/api/checkin/status");
        if (cancelled) return;
        if (res.status === "belum_checkin") {
          router.replace("/pemilih");
          return;
        }
        if (res.status === "menunggu" || res.status === "di_bilik") {
          router.replace("/pemilih/bilik");
          return;
        }
        setData(res);
        // Selalu cek /api/hasil secara real-time tanpa harus menunggu scan pintu keluar
        try {
          const h = await apiFetch<HasilRes>("/api/hasil");
          if (!cancelled && h) setHasil(h);
        } catch {
          // Abaikan jika belum ada hasil
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Gagal memuat status");
      }
    }
    load();
    const id = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [router]);

  const sudahSelesai = Boolean(data?.buktiSudahDiscan || data?.status === "selesai");

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto space-y-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-bold">Bukti Memilih</h1>
        {sudahSelesai && <LogoutButton />}
      </header>

      {error && (
        <div className="bg-white rounded-xl shadow p-6 text-center space-y-3">
          <p className="text-red-600 text-sm">{error}</p>
          <a
            href="/pemilih"
            className="inline-block text-sm text-emerald-600 font-medium hover:underline pt-1"
          >
            &larr; Kembali ke Beranda Pemilih
          </a>
        </div>
      )}

      {data?.buktiQrPayload && !sudahSelesai && (
        <div className="bg-white rounded-xl shadow p-6 text-center space-y-3">
          <DisplayQr payload={data.buktiQrPayload} />
          <p className="text-sm text-slate-600">Tunjukkan barcode ini ke panitia di pintu keluar.</p>
          <p className="text-xs text-amber-600">Jangan screenshot atau bagikan barcode ini ke orang lain.</p>
        </div>
      )}

      {sudahSelesai && (!hasil || !hasil.diumumkan) && (
        <div className="bg-white rounded-xl shadow p-8 text-center space-y-2">
          <p className="text-lg font-bold">Terima kasih sudah berpartisipasi dalam pemilihan!</p>
          <p className="text-sm text-slate-500">Silakan menunggu untuk melihat hasilnya.</p>
        </div>
      )}

      {hasil?.diumumkan && (
        <div className="space-y-4">
          <div className="bg-emerald-50 rounded-xl p-4 text-center">
            <p className="font-bold text-emerald-700">Hasil Pemilihan</p>
            <p className="text-xs text-emerald-600 mt-0.5">Total suara: {hasil.total_suara}</p>
          </div>

          {/* Visualisasi Grafik Batang & Lingkaran */}
          <HasilCharts
            perPaslon={hasil.per_paslon ?? []}
            totalSuara={hasil.total_suara ?? 0}
            jumlahAbstain={hasil.jumlah_abstain ?? 0}
          />

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-1">
              Rincian Perolehan Paslon
            </h4>
            {hasil.per_paslon?.map((p) => (
              <div key={p.kandidat_id} className="bg-white rounded-xl shadow p-4 flex items-center gap-3">
                <div className="flex -space-x-2 shrink-0">
                  <CandidateAvatar nama={p.nama_ketua} foto={p.foto_ketua} size={40} />
                  <CandidateAvatar nama={p.nama_wakil} foto={p.foto_wakil} size={40} />
                </div>
                <p className="flex-1 text-sm font-medium">No. {p.nomor_urut} -- {p.nama_ketua} &amp; {p.nama_wakil}</p>
                <p className="font-bold text-lg">{p.jumlah_suara}</p>
              </div>
            ))}

            {(hasil.jumlah_abstain ?? 0) > 0 && (
              <div className="bg-white rounded-xl shadow p-4 flex items-center justify-between border border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-slate-400"></span>
                  <p className="text-sm font-medium text-slate-600">Abstain / Suara Kosong</p>
                </div>
                <p className="font-bold text-lg text-slate-700">{hasil.jumlah_abstain}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {data && !data.buktiQrPayload && <p className="text-sm text-slate-500 text-center">Status: {data.status}</p>}
    </main>
  );
}
