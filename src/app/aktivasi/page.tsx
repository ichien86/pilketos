"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client-fetch";

export default function AktivasiPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tanggalLahir, setTanggalLahir] = useState("");
  const [passwordBaru, setPasswordBaru] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/api/akun/aktivasi", {
        method: "POST",
        body: JSON.stringify({
          username,
          password,
          tanggal_lahir: tanggalLahir,
          password_baru: passwordBaru,
        }),
      });
      router.push("/pemilih");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal aktivasi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-6 space-y-4">
        <div>
          <h1 className="text-lg font-bold">Aktivasi Akun Pertama Kali</h1>
          <p className="text-sm text-slate-500">US-02 -- butuh username, password default, dan tanggal lahir sesuai data DPT.</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Username (NIS/NIP)</label>
            <input className="w-full border rounded-lg px-3 py-2" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Password default (dari panitia)</label>
            <input type="password" className="w-full border rounded-lg px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Tanggal lahir</label>
            <input type="date" className="w-full border rounded-lg px-3 py-2" value={tanggalLahir} onChange={(e) => setTanggalLahir(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Password baru (min. 8 karakter)</label>
            <input type="password" className="w-full border rounded-lg px-3 py-2" value={passwordBaru} onChange={(e) => setPasswordBaru(e.target.value)} required minLength={8} />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white rounded-lg py-2 font-medium disabled:opacity-50">
            {loading ? "Memproses..." : "Aktivasi & Masuk"}
          </button>
        </form>
        <a href="/" className="block text-center text-sm text-blue-600 hover:underline">Kembali ke login</a>
      </div>
    </main>
  );
}
