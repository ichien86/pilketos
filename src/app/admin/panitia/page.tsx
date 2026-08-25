"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/client-fetch";

interface Staf {
  _id: string;
  username: string;
  role: "panitia" | "pengawas";
  wajib_ganti_password: boolean;
  created_at: string;
}

const ROLE_LABEL: Record<Staf["role"], string> = {
  panitia: "Panitia Pemilihan",
  pengawas: "Panitia Pengawas",
};

// Kelola akun panitia pemilihan & panitia pengawas -- akun admin tetap
// hanya bisa dibuat lewat CLI di server (lihat DEPLOY_FLY.md), sengaja
// tidak diekspos di sini.
export default function AdminPanitiaPage() {
  const [list, setList] = useState<Staf[]>([]);
  const [role, setRole] = useState<Staf["role"]>("panitia");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<{ username: string; password_default: string } | null>(null);

  async function refresh() {
    setList(await apiFetch<Staf[]>("/api/staff"));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch<{ username: string; password_default: string }>("/api/staff", {
        method: "POST",
        body: JSON.stringify({ role, username }),
      });
      setInfo(res);
      setUsername("");
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menambah akun");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(s: Staf) {
    setError(null);
    try {
      const res = await apiFetch<{ username: string; password_default: string }>(`/api/staff/${s._id}/reset-password`, {
        method: "POST",
      });
      setInfo(res);
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal reset password");
    }
  }

  async function hapus(s: Staf) {
    if (!confirm(`Hapus akun ${ROLE_LABEL[s.role].toLowerCase()} "${s.username}"?`)) return;
    setError(null);
    try {
      await apiFetch(`/api/staff/${s._id}`, { method: "DELETE" });
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menghapus akun");
    }
  }

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto space-y-6">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-bold">Panitia & Pengawas</h1>
        <a href="/admin/fase" className="text-sm text-blue-600 hover:underline">Kembali</a>
      </header>

      <form onSubmit={tambah} className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-bold">Tambah Akun</h2>
        <p className="text-xs text-slate-400">
          Password awal semua akun baru sama: <span className="font-mono">panitiapilketosman3</span>. Setiap orang wajib ganti password sendiri saat login pertama.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <select className="border rounded-lg px-3 py-2" value={role} onChange={(e) => setRole(e.target.value as Staf["role"])}>
            <option value="panitia">Panitia Pemilihan</option>
            <option value="pengawas">Panitia Pengawas</option>
          </select>
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={busy} className="w-full bg-slate-900 text-white rounded-lg py-2 disabled:opacity-50">
          Tambah
        </button>
      </form>

      {info && (
        <p className="text-sm bg-amber-50 rounded-lg p-3">
          Akun <b>{info.username}</b> siap dipakai, password: <span className="font-mono">{info.password_default}</span>
          <br />Wajib diganti oleh pemiliknya di login pertama.
        </p>
      )}

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-bold">Daftar Akun ({list.length})</h2>
        <div className="divide-y">
          {list.map((s) => (
            <div key={s._id} className="py-2.5 flex items-center justify-between gap-2 text-sm">
              <div>
                <p className="font-medium">{s.username}</p>
                <p className="text-slate-400 text-xs">
                  {ROLE_LABEL[s.role]} &middot; {s.wajib_ganti_password ? "belum ganti password" : "sudah ganti password"}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => resetPassword(s)} className="text-xs text-blue-600 hover:underline">Reset Password</button>
                <button onClick={() => hapus(s)} className="text-xs text-red-600 hover:underline">Hapus</button>
              </div>
            </div>
          ))}
          {list.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">Belum ada akun panitia/pengawas.</p>}
        </div>
      </div>
    </main>
  );
}
