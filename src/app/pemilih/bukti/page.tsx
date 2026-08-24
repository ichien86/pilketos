"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-fetch";
import DisplayQr from "@/components/DisplayQr";

interface StatusRes {
  status: string;
  buktiQrPayload: string | null;
  buktiSudahDiscan: boolean;
}

// US-15 -- pulihkan barcode bukti kapan saja pakai voteToken yang sama,
// murni baca status, tidak pernah membuat suara baru.
export default function BuktiPage() {
  const [data, setData] = useState<StatusRes | null>(null);
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
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Gagal memuat status");
      }
    }
    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto space-y-4">
      <h1 className="text-lg font-bold pt-2">Bukti Memilih</h1>
      <div className="bg-white rounded-xl shadow p-6 text-center space-y-3">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {data?.buktiQrPayload && (
          <>
            <DisplayQr payload={data.buktiQrPayload} />
            <p className="text-sm text-slate-600">
              {data.buktiSudahDiscan
                ? "Sudah discan panitia di pintu keluar. Terima kasih!"
                : "Tunjukkan barcode ini ke panitia di pintu keluar."}
            </p>
          </>
        )}
        {data && !data.buktiQrPayload && <p className="text-sm text-slate-500">Status: {data.status}</p>}
      </div>
    </main>
  );
}
