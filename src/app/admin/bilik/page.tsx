"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/client-fetch";
import DisplayQr from "@/components/DisplayQr";
import { useRole } from "@/lib/use-role";

interface Bilik {
  _id: string;
  nomor_bilik: number;
  qr_hash: string;
  status: "kosong" | "terisi";
}

// Bagian 4.2 / US-26 -- konfigurasi jumlah bilik fisik produksi.
export default function AdminBilikPage() {
  const role = useRole();
  const isPengawas = role === "pengawas";
  const [list, setList] = useState<Bilik[]>([]);
  const [nomor, setNomor] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setList(await apiFetch<Bilik[]>("/api/admin/bilik"));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/admin/bilik", { method: "POST", body: JSON.stringify({ nomor_bilik: Number(nomor) }) });
      setNomor("");
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menambah bilik");
    }
  }

  async function hapus(id: string) {
    if (!confirm("Hapus bilik ini?")) return;
    setError(null);
    try {
      await apiFetch(`/api/admin/bilik/${id}`, { method: "DELETE" });
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menghapus (mungkin sedang terisi)");
    }
  }

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto space-y-6">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-bold">Konfigurasi Bilik</h1>
        <a href={role === "admin" ? "/admin/fase" : role === "pengawas" ? "/pengawas" : "/panitia"} className="text-sm text-blue-600 hover:underline">Kembali</a>
      </header>

      {isPengawas && (
        <p className="text-sm bg-slate-100 text-slate-500 rounded-lg p-3">
          Akses pengawas: hanya bisa melihat data, tidak bisa mengubah apa pun di halaman ini.
        </p>
      )}

      {!isPengawas && (
      <form onSubmit={tambah} className="bg-white rounded-xl shadow p-4 flex gap-2">
        <input className="flex-1 border rounded-lg px-3 py-2" placeholder="Nomor bilik" value={nomor} onChange={(e) => setNomor(e.target.value)} required />
        <button type="submit" className="bg-slate-900 text-white rounded-lg px-4">Tambah</button>
      </form>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="grid sm:grid-cols-2 gap-4">
        {list.map((b) => (
          <div key={b._id} className="bg-white rounded-xl shadow p-4 text-center space-y-2">
            <p className="font-bold">Bilik {b.nomor_bilik}</p>
            <DisplayQr payload={b.qr_hash} size={160} />
            <p className="text-xs text-slate-400">Cetak & tempel QR ini di bilik fisik</p>
            {!isPengawas && (
              <button onClick={() => hapus(b._id)} className="text-sm text-red-600 hover:underline">Hapus</button>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
