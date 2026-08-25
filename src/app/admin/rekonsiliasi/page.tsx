"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-fetch";
import { useRole } from "@/lib/use-role";

interface Rekon {
  mode: string;
  total_token_terbit: number;
  total_sudah_memilih: number;
  total_scan_keluar: number;
  total_suara: number;
  per_paslon: Array<{ kandidat_id: string; nomor_urut: number | null; nama: string; jumlah_suara: number }>;
  perlu_investigasi: boolean;
}

// US-17 -- rekap agregat, tanpa membuka data mentah siapa pun.
export default function RekonsiliasiPage() {
  const role = useRole();
  const [mode, setMode] = useState<"prod" | "simulasi">("prod");
  const [data, setData] = useState<Rekon | null>(null);

  useEffect(() => {
    apiFetch<Rekon>(`/api/admin/rekonsiliasi?mode=${mode}`).then(setData);
  }, [mode]);

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto space-y-6">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-bold">Rekonsiliasi</h1>
        <a href={role === "admin" ? "/admin/fase" : role === "pengawas" ? "/pengawas" : "/panitia"} className="text-sm text-blue-600 hover:underline">Kembali</a>
      </header>

      <div className="flex gap-2">
        <button onClick={() => setMode("prod")} className={`flex-1 rounded-lg py-2 ${mode === "prod" ? "bg-slate-900 text-white" : "border"}`}>Produksi</button>
        <button onClick={() => setMode("simulasi")} className={`flex-1 rounded-lg py-2 ${mode === "simulasi" ? "bg-slate-900 text-white" : "border"}`}>Simulasi</button>
      </div>

      {data && (
        <>
          {data.perlu_investigasi && (
            <div className="bg-red-100 text-red-700 rounded-lg p-3 text-sm font-medium">
              Total sudah-memilih tidak sama dengan total suara -- PERLU INVESTIGASI sebelum hasil diumumkan.
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Token terbit" value={data.total_token_terbit} />
            <Stat label="Sudah memilih" value={data.total_sudah_memilih} />
            <Stat label="Scan keluar" value={data.total_scan_keluar} />
            <Stat label="Total suara" value={data.total_suara} />
          </div>
          <div className="bg-white rounded-xl shadow divide-y">
            {data.per_paslon.map((p) => (
              <div key={p.kandidat_id} className="p-3 flex items-center justify-between">
                <span>No. {p.nomor_urut} -- {p.nama}</span>
                <span className="font-bold">{p.jumlah_suara}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
