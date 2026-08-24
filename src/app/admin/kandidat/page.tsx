"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/client-fetch";

interface Kandidat {
  _id: string;
  nomor_urut: number;
  nama_ketua: string;
  nama_wakil: string;
  foto_ketua: string | null;
  foto_wakil: string | null;
  visi: string | null;
  misi: string | null;
  status: "draft" | "aktif" | "dibatalkan";
}

const KOSONG = { nomor_urut: "", nama_ketua: "", nama_wakil: "", foto_ketua: "", foto_wakil: "", visi: "", misi: "" };

// US-06/07/08/09 -- CRUD kandidat, publish, batalkan, buat akun paslon.
export default function AdminKandidatPage() {
  const [list, setList] = useState<Kandidat[]>([]);
  const [form, setForm] = useState(KOSONG);
  const [error, setError] = useState<string | null>(null);
  const [akunInfo, setAkunInfo] = useState<{ username: string; password_sementara: string } | null>(null);

  async function refresh() {
    setList(await apiFetch<Kandidat[]>("/api/kandidat"));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/kandidat", {
        method: "POST",
        body: JSON.stringify({ ...form, nomor_urut: Number(form.nomor_urut) }),
      });
      setForm(KOSONG);
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menambah kandidat");
    }
  }

  async function publish(id: string) {
    setError(null);
    try {
      await apiFetch(`/api/kandidat/${id}/publish`, { method: "POST" });
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal publish");
    }
  }

  async function batalkan(id: string) {
    if (!confirm("Batalkan paslon ini?")) return;
    setError(null);
    try {
      await apiFetch(`/api/kandidat/${id}/batalkan`, { method: "POST" });
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal membatalkan");
    }
  }

  async function buatAkun(id: string) {
    setError(null);
    try {
      const res = await apiFetch<{ username: string; password_sementara: string }>(`/api/kandidat/${id}/akun`, { method: "POST" });
      setAkunInfo(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal membuat akun");
    }
  }

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto space-y-6">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-bold">Kandidat</h1>
        <a href="/admin/fase" className="text-sm text-blue-600 hover:underline">Kembali</a>
      </header>

      <form onSubmit={tambah} className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-bold">Tambah Kandidat (draft)</h2>
        <div className="grid grid-cols-2 gap-2">
          <input className="border rounded-lg px-3 py-2" placeholder="Nomor urut" value={form.nomor_urut} onChange={(e) => setForm({ ...form, nomor_urut: e.target.value })} required />
          <div />
          <input className="border rounded-lg px-3 py-2" placeholder="Nama Ketua" value={form.nama_ketua} onChange={(e) => setForm({ ...form, nama_ketua: e.target.value })} />
          <input className="border rounded-lg px-3 py-2" placeholder="Nama Wakil" value={form.nama_wakil} onChange={(e) => setForm({ ...form, nama_wakil: e.target.value })} />
          <input className="border rounded-lg px-3 py-2" placeholder="URL Foto Ketua" value={form.foto_ketua} onChange={(e) => setForm({ ...form, foto_ketua: e.target.value })} />
          <input className="border rounded-lg px-3 py-2" placeholder="URL Foto Wakil" value={form.foto_wakil} onChange={(e) => setForm({ ...form, foto_wakil: e.target.value })} />
        </div>
        <textarea className="w-full border rounded-lg px-3 py-2" placeholder="Visi" value={form.visi} onChange={(e) => setForm({ ...form, visi: e.target.value })} />
        <div>
          <textarea
            className="w-full border rounded-lg px-3 py-2"
            placeholder={"Misi\nSatu poin per baris, contoh:\nMengadakan program mentoring lintas angkatan\nMembuka kanal aspirasi digital"}
            rows={4}
            value={form.misi}
            onChange={(e) => setForm({ ...form, misi: e.target.value })}
          />
          <p className="text-xs text-slate-400 mt-1">Tekan Enter di antar poin -- akan ditampilkan bernomor otomatis ke pemilih.</p>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" className="w-full bg-slate-900 text-white rounded-lg py-2">Tambah</button>
      </form>

      {akunInfo && (
        <p className="text-sm bg-amber-50 rounded-lg p-3">
          Akun paslon dibuat: <b>{akunInfo.username}</b> / password sementara: <span className="font-mono">{akunInfo.password_sementara}</span>
        </p>
      )}

      <div className="space-y-3">
        {list.map((k) => (
          <div key={k._id} className="bg-white rounded-xl shadow p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">No. {k.nomor_urut} -- {k.nama_ketua} & {k.nama_wakil}</h3>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  k.status === "aktif" ? "bg-emerald-100 text-emerald-700" : k.status === "dibatalkan" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {k.status}
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {k.status === "draft" && (
                <button onClick={() => publish(k._id)} className="text-sm bg-emerald-600 text-white rounded-lg px-3 py-1.5">Publish</button>
              )}
              {k.status === "aktif" && (
                <>
                  <button onClick={() => batalkan(k._id)} className="text-sm bg-red-600 text-white rounded-lg px-3 py-1.5">Batalkan</button>
                  <button onClick={() => buatAkun(k._id)} className="text-sm border rounded-lg px-3 py-1.5">Buat Akun Paslon</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
