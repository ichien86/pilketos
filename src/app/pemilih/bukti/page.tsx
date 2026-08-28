"use client";

import { useEffect, useState } from "react";
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
  per_paslon?: HasilPaslon[];
}

// US-15 -- pulihkan barcode bukti kapan saja pakai voteToken yang sama,
// murni baca status, tidak pernah membuat suara baru. Setelah discan panitia
// di pintu keluar, barcode-nya sudah tidak relevan lagi (sekali pakai) --
// layar berganti jadi ucapan terima kasih, lalu hasil begitu admin umumkan.
export default function BuktiPage() {
  const [data, setData] = useState<StatusRes | null>(null);
  const [hasil, setHasil] = useState<HasilRes | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("pilketos_voteToken");
    if (!t) {
      setError("Token tidak ditemukan di perangkat ini.");
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const res = await apiFetch<StatusRes>(`/api/vote/${t}/status`);
        if (cancelled) return;
        setData(res);
        if (res.buktiSudahDiscan) {
          const h = await apiFetch<HasilRes>("/api/hasil");
          if (!cancelled) setHasil(h);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Gagal memuat status");
      }
    }
    load();
    const id = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto space-y-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-bold">Bukti Memilih</h1>
        {/* Baru muncul SETELAH discan panitia di pintu keluar -- supaya tidak
            memberi sinyal "sudah boleh pergi" sebelum proses itu benar-benar
            terjadi, sambil tetap menyediakan cara keluar untuk perangkat
            sekolah yang dipakai bergantian setelah pemilih benar-benar selesai. */}
        {data?.buktiSudahDiscan && <LogoutButton />}
      </header>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {data?.buktiQrPayload && !data.buktiSudahDiscan && (
        <div className="bg-white rounded-xl shadow p-6 text-center space-y-3">
          <DisplayQr payload={data.buktiQrPayload} />
          <p className="text-sm text-slate-600">Tunjukkan barcode ini ke panitia di pintu keluar.</p>
          <p className="text-xs text-amber-600">Jangan screenshot atau bagikan barcode ini ke orang lain.</p>
        </div>
      )}

      {data?.buktiSudahDiscan && (!hasil || !hasil.diumumkan) && (
        <div className="bg-white rounded-xl shadow p-8 text-center space-y-2">
          <p className="text-lg font-bold">Terima kasih sudah berpartisipasi dalam pemilihan!</p>
          <p className="text-sm text-slate-500">Silakan menunggu untuk melihat hasilnya.</p>
        </div>
      )}

      {hasil?.diumumkan && (
        <div className="space-y-3">
          <div className="bg-emerald-50 rounded-xl p-4 text-center">
            <p className="font-bold text-emerald-700">Hasil Pemilihan</p>
            <p className="text-xs text-emerald-600 mt-0.5">Total suara: {hasil.total_suara}</p>
          </div>
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
        </div>
      )}

      {data && !data.buktiQrPayload && <p className="text-sm text-slate-500 text-center">Status: {data.status}</p>}
    </main>
  );
}
