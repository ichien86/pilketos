"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/client-fetch";

const ROLE_HOME: Record<string, string> = {
  admin: "/admin/fase",
  panitia: "/panitia/checkin",
  pemilih: "/pemilih",
  kandidat: "/kandidat/video",
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ role: string; wajib_ganti_password: boolean }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      if (res.wajib_ganti_password) {
        router.push("/ganti-password");
        return;
      }
      router.push(ROLE_HOME[res.role] ?? "/");
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setError(e.message + " -- coba halaman Aktivasi Akun di bawah.");
      } else {
        setError(e instanceof Error ? e.message : "Gagal login");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-6 space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-lg font-bold">E-Voting OSIM</h1>
          <p className="text-sm text-slate-500">MAN 3 Boyolali</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Username (NIS/NIP?NIK)</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Password</label>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white rounded-lg py-2 font-medium disabled:opacity-50"
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>
        <a href="/aktivasi" className="block text-center text-sm text-blue-600 hover:underline">
          Pertama kali login? Aktivasi akun di sini
        </a>
      </div>
    </main>
  );
}
