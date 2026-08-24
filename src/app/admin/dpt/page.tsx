"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/client-fetch";

interface Ringkasan {
  total_baris_siswa: number;
  total_baris_guru: number;
  valid: number;
  error: number;
  detail_error: Array<{ jenis: string; baris: number; pesan: string }>;
  ter_commit?: number;
}

// US-01 -- import DPT (dry-run lalu commit) + US-04 reset password.
export default function AdminDptPage() {
  const [file, setFile] = useState<File | null>(null);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [resetUsername, setResetUsername] = useState("");
  const [resetResult, setResetResult] = useState<{ username: string; password_sementara: string } | null>(null);

  async function jalankan(mode: "dry-run" | "commit") {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("mode", mode);
      const res = await apiFetch<{ ringkasan: Ringkasan }>("/api/dpt/import", { method: "POST", body: form });
      setRingkasan(res.ringkasan);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal memproses file");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetResult(null);
    try {
      const res = await apiFetch<{ username: string; password_sementara: string }>("/api/akun/reset-password", {
        method: "POST",
        body: JSON.stringify({ username: resetUsername }),
      });
      setResetResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal reset password");
    }
  }

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto space-y-6">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-bold">Data Pemilih Tetap (DPT)</h1>
        <a href="/admin/fase" className="text-sm text-blue-600 hover:underline">Kembali</a>
      </header>

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <p className="text-sm text-slate-600">
          File Excel dengan sheet <code>Siswa</code> (NIS, Nama, Kelas, Tanggal Lahir) dan <code>Guru</code> (NIP, Nama, Pangkat, Tanggal Lahir).
        </p>
        <input type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <div className="flex gap-2">
          <button onClick={() => jalankan("dry-run")} disabled={!file || busy} className="flex-1 border rounded-lg py-2 disabled:opacity-50">
            Cek (Dry-run)
          </button>
          <button onClick={() => jalankan("commit")} disabled={!file || busy} className="flex-1 bg-slate-900 text-white rounded-lg py-2 disabled:opacity-50">
            Commit ke Database
          </button>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {ringkasan && (
          <div className="text-sm space-y-1 border-t pt-3">
            <p>Baris siswa: {ringkasan.total_baris_siswa}, guru: {ringkasan.total_baris_guru}</p>
            <p className="text-emerald-700">Valid: {ringkasan.valid}</p>
            <p className="text-red-600">Error: {ringkasan.error}</p>
            {ringkasan.ter_commit !== undefined && <p className="font-medium">Ter-commit: {ringkasan.ter_commit}</p>}
            {ringkasan.detail_error.length > 0 && (
              <ul className="list-disc pl-5 text-slate-500 max-h-40 overflow-y-auto">
                {ringkasan.detail_error.map((e, i) => (
                  <li key={i}>{e.jenis} baris {e.baris}: {e.pesan}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-bold">Reset Password Pemilih</h2>
        <form onSubmit={resetPassword} className="flex gap-2">
          <input
            className="flex-1 border rounded-lg px-3 py-2"
            placeholder="NIS/NIP"
            value={resetUsername}
            onChange={(e) => setResetUsername(e.target.value)}
          />
          <button type="submit" className="bg-slate-900 text-white rounded-lg px-4">Reset</button>
        </form>
        {resetResult && (
          <p className="text-sm bg-amber-50 rounded-lg p-3">
            Password sementara untuk <b>{resetResult.username}</b>: <span className="font-mono">{resetResult.password_sementara}</span>
            <br />Pemilih harus mengulang alur aktivasi (tanggal lahir) dengan password ini.
          </p>
        )}
      </div>
    </main>
  );
}
