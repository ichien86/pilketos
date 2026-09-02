"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client-fetch";
import PasswordInput from "@/components/PasswordInput";

export default function GantiPasswordPage() {
  const router = useRouter();
  const [passwordLama, setPasswordLama] = useState("");
  const [passwordBaru, setPasswordBaru] = useState("");
  const [konfirmasiPasswordBaru, setKonfirmasiPasswordBaru] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (passwordBaru !== konfirmasiPasswordBaru) {
      setError("Password baru dan konfirmasi password tidak sama");
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/api/akun/ganti-password", {
        method: "POST",
        body: JSON.stringify({ password_lama: passwordLama, password_baru: passwordBaru }),
      });
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal ganti password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-6 space-y-4">
        <h1 className="text-lg font-bold">Wajib Ganti Password</h1>
        <p className="text-sm text-slate-500">Login pertama kali harus mengganti password sementara Anda.</p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="gp-lama" className="text-sm font-medium block mb-1">Password lama/sementara</label>
            <PasswordInput id="gp-lama" value={passwordLama} onChange={setPasswordLama} required />
          </div>
          <div>
            <label htmlFor="gp-baru" className="text-sm font-medium block mb-1">Password baru (min. 8 karakter)</label>
            <PasswordInput id="gp-baru" value={passwordBaru} onChange={setPasswordBaru} required minLength={8} />
          </div>
          <div>
            <label htmlFor="gp-konfirmasi" className="text-sm font-medium block mb-1">Ulangi password baru</label>
            <PasswordInput id="gp-konfirmasi" value={konfirmasiPasswordBaru} onChange={setKonfirmasiPasswordBaru} required minLength={8} />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white rounded-lg py-2 font-medium disabled:opacity-50">
            {loading ? "Memproses..." : "Simpan & Login Ulang"}
          </button>
        </form>
      </div>
    </main>
  );
}
