"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client-fetch";
import PasswordInput from "@/components/PasswordInput";
import { JENIS_BUKTI_IDENTITAS, type JenisBuktiIdentitas } from "@/types";

export default function AktivasiPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tanggalLahir, setTanggalLahir] = useState("");
  const [passwordBaru, setPasswordBaru] = useState("");
  const [buktiJenis, setBuktiJenis] = useState<JenisBuktiIdentitas | "">("");
  const [buktiJenisLainnya, setBuktiJenisLainnya] = useState("");
  const [buktiNomor, setBuktiNomor] = useState("");
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
          bukti_jenis: buktiJenis,
          bukti_jenis_lainnya: buktiJenisLainnya,
          bukti_nomor: buktiNomor,
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
            <PasswordInput value={password} onChange={setPassword} required />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Tanggal lahir</label>
            <input type="date" className="w-full border rounded-lg px-3 py-2" value={tanggalLahir} onChange={(e) => setTanggalLahir(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Password baru (min. 8 karakter)</label>
            <PasswordInput value={passwordBaru} onChange={setPasswordBaru} required minLength={8} />
          </div>
          <div className="border-t pt-3 space-y-3">
            <p className="text-xs text-slate-500">
              Bukti diri ini WAJIB dibawa fisik ke TPS saat hari-H -- bisa diubah lagi nanti kalau berubah.
            </p>
            <div>
              <label className="text-sm font-medium block mb-1">Jenis bukti diri</label>
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={buktiJenis}
                onChange={(e) => setBuktiJenis(e.target.value as JenisBuktiIdentitas)}
                required
              >
                <option value="" disabled>Pilih jenis dokumen</option>
                {JENIS_BUKTI_IDENTITAS.map((j) => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>
            </div>
            {buktiJenis === "Lainnya" && (
              <div>
                <label className="text-sm font-medium block mb-1">Nama dokumen</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={buktiJenisLainnya}
                  onChange={(e) => setBuktiJenisLainnya(e.target.value)}
                  placeholder="mis. Surat Keterangan Domisili"
                  required
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium block mb-1">Nomor identitas dokumen tersebut</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={buktiNomor}
                onChange={(e) => setBuktiNomor(e.target.value)}
                required
              />
            </div>
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
