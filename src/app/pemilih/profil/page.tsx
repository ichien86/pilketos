"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-fetch";

// US-03 -- profil opsional, terpisah dari data resmi DPT.
export default function ProfilPage() {
  const [alamat, setAlamat] = useState("");
  const [hobi, setHobi] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ alamat: string | null; hobi: string | null }>("/api/akun/profil").then((res) => {
      setAlamat(res.alamat ?? "");
      setHobi(res.hobi ?? "");
    });
  }, []);

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await apiFetch("/api/akun/profil", { method: "PUT", body: JSON.stringify({ alamat, hobi }) });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan");
    }
  }

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto space-y-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-bold">Profil (Opsional)</h1>
        <a href="/pemilih" className="text-sm text-blue-600 hover:underline">Kembali</a>
      </header>
      <form onSubmit={simpan} className="bg-white rounded-xl shadow p-4 space-y-3">
        <div>
          <label htmlFor="profil-alamat" className="text-sm font-medium block mb-1">Alamat rumah</label>
          <textarea id="profil-alamat" className="w-full border rounded-lg px-3 py-2" value={alamat} onChange={(e) => setAlamat(e.target.value)} rows={2} />
        </div>
        <div>
          <label htmlFor="profil-hobi" className="text-sm font-medium block mb-1">Hobi</label>
          <input id="profil-hobi" className="w-full border rounded-lg px-3 py-2" value={hobi} onChange={(e) => setHobi(e.target.value)} />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {saved && <p className="text-emerald-600 text-sm">Tersimpan.</p>}
        <button type="submit" className="w-full bg-slate-900 text-white rounded-lg py-2 font-medium">Simpan</button>
      </form>
    </main>
  );
}
