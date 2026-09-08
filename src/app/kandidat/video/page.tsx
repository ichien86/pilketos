"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/client-fetch";
import LogoutButton from "@/components/LogoutButton";

interface Video {
  _id: string;
  url: string;
  status: "draft" | "aktif";
  created_at?: string;
  published_at?: string | null;
}

const MAX_VIDEO_MB = 50;
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;
const ALLOWED_EXTS = [".mp4", ".webm", ".mov", ".m4v"];

// US-10 -- kandidat unggah video kampanye (draft), publish sendiri,
// hapus draft jika salah, atau batalkan publish jika butuh koreksi sebelum sosialisasi.
export default function KandidatVideoPage() {
  const [videoList, setVideoList] = useState<Video[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  async function refresh() {
    try {
      const list = await apiFetch<Video[]>("/api/video");
      setVideoList(list);
    } catch {
      // Abaikan error saat inisialisasi
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setSuccess(null);
    const selected = e.target.files?.[0];
    if (!selected) {
      setFile(null);
      return;
    }

    const ext = "." + selected.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      setError("Format file tidak didukung. Harap gunakan format MP4, WEBM, MOV, atau M4V.");
      setFile(null);
      e.target.value = "";
      return;
    }

    if (selected.size > MAX_VIDEO_BYTES) {
      const sizeMb = (selected.size / (1024 * 1024)).toFixed(1);
      setError(
        `Ukuran file video (${sizeMb} MB) melebihi batas maksimal ${MAX_VIDEO_MB} MB. Silakan kompres video Anda terlebih dahulu.`
      );
      setFile(null);
      e.target.value = "";
      return;
    }

    setFile(selected);
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const form = new FormData();
      form.append("file", file);
      await apiFetch("/api/video", { method: "POST", body: form });
      setFile(null);
      setSuccess("✓ Video baru berhasil diunggah sebagai draft! Silakan periksa sebelum dipublish.");
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal mengunggah video");
    } finally {
      setBusy(false);
    }
  }

  async function publish(id: string) {
    if (actionBusyId) return;
    if (!confirm("Publikasikan video ini sekarang? Video yang aktif akan dapat ditonton oleh pemilih saat tahap sosialisasi dibuka.")) {
      return;
    }
    setActionBusyId(id);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/api/video/${id}/publish`, { method: "POST" });
      setSuccess("✓ Video berhasil dipublikasikan (status aktif)!");
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal mempublikasikan video");
    } finally {
      setActionBusyId(null);
    }
  }

  async function unpublish(id: string) {
    if (actionBusyId) return;
    if (!confirm("Batalkan publikasi video ini? Video akan kembali menjadi status draft dan tidak dapat ditonton oleh pemilih.")) {
      return;
    }
    setActionBusyId(id);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/api/video/${id}/unpublish`, { method: "POST" });
      setSuccess("✓ Publikasi video berhasil dibatalkan. Status video kembali ke draft.");
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal membatalkan publikasi video");
    } finally {
      setActionBusyId(null);
    }
  }

  async function hapusDraft(id: string) {
    if (actionBusyId) return;
    if (!confirm("Apakah Anda yakin ingin menghapus video draft ini? File video akan dihapus permanen dari server.")) {
      return;
    }
    setActionBusyId(id);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/api/video/${id}`, { method: "DELETE" });
      setSuccess("✓ Video draft berhasil dihapus.");
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menghapus video draft");
    } finally {
      setActionBusyId(null);
    }
  }

  return (
    <main className="min-h-screen p-4 max-w-xl mx-auto space-y-6">
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Video Kampanye Paslon</h1>
          <p className="text-xs text-slate-500">Kelola video visi &amp; misi untuk disosialisasikan ke pemilih</p>
        </div>
        <LogoutButton />
      </header>

      {/* Banner Notifikasi Sukses */}
      {success && (
        <div className="bg-emerald-50 border-2 border-emerald-500 text-emerald-950 p-4 rounded-xl text-sm font-medium shadow-sm flex items-start justify-between gap-3">
          <p className="text-xs text-emerald-800 leading-relaxed font-semibold">{success}</p>
          <button
            onClick={() => setSuccess(null)}
            className="text-emerald-800 hover:text-emerald-950 text-xs px-2 py-1 rounded bg-emerald-100 hover:bg-emerald-200 font-bold shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Banner Notifikasi Error */}
      {error && (
        <div className="bg-red-50 border-2 border-red-500 text-red-950 p-4 rounded-xl text-sm font-medium shadow-sm flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="font-bold text-red-900 text-sm">⚠️ Terjadi Kesalahan</p>
            <p className="text-xs text-red-800 leading-relaxed">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-800 hover:text-red-950 text-xs px-2 py-1 rounded bg-red-100 hover:bg-red-200 font-bold shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Form Unggah Video */}
      <form onSubmit={upload} className="bg-white rounded-xl shadow p-5 space-y-4 border border-slate-200">
        <h2 className="font-bold text-slate-900 text-sm">Unggah Video Kampanye</h2>

        <div className="space-y-2">
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
            disabled={busy}
            onChange={handleFileChange}
            className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer disabled:opacity-50"
          />

          {file && (
            <div className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700">
              <span className="font-semibold truncate">📁 {file.name}</span>
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-mono text-[11px] shrink-0">
                {(file.size / (1024 * 1024)).toFixed(1)} MB
              </span>
            </div>
          )}

          <div className="text-[11px] text-slate-500 bg-slate-50 rounded-lg p-2.5 space-y-0.5 border border-slate-100">
            <p className="font-semibold text-slate-700">ℹ️ Ketentuan Video Kampanye:</p>
            <ul className="list-disc list-inside space-y-0.5 text-slate-600">
              <li>Maksimal ukuran file: <strong>{MAX_VIDEO_MB} MB</strong>.</li>
              <li>Format didukung: <strong>MP4, WEBM, MOV, M4V</strong>.</li>
              <li>Durasi disarankan: <strong>1 s.d. 3 menit</strong> (video ringkas perkenalan &amp; visi-misi).</li>
            </ul>
          </div>
        </div>

        <button
          type="submit"
          disabled={!file || busy}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg py-2.5 text-sm disabled:opacity-50 transition flex items-center justify-center gap-2"
        >
          {busy ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0"></span>
              <span>Sedang Mengunggah... (Harap Tunggu)</span>
            </>
          ) : (
            "Unggah Video (Status Draft)"
          )}
        </button>
      </form>

      {/* Daftar Video */}
      <div className="space-y-4">
        <h2 className="font-bold text-slate-900 text-sm">Daftar Video Anda</h2>

        {videoList.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-6 text-center text-sm text-slate-500 border border-slate-100">
            Belum ada video kampanye yang diunggah. Silakan unggah video melalui formulir di atas.
          </div>
        ) : (
          videoList.map((v) => {
            const isItemBusy = actionBusyId === v._id;
            return (
              <div key={v._id} className="bg-white rounded-xl shadow p-4 space-y-3 border border-slate-200">
                <video src={v.url} controls className="w-full rounded-lg bg-black aspect-video object-contain" />
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1.5 ${
                        v.status === "aktif"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-amber-100 text-amber-800 border border-amber-300"
                      }`}
                    >
                      <span>{v.status === "aktif" ? "🟢" : "🟡"}</span>
                      <span>{v.status === "aktif" ? "Aktif (Terpublikasi)" : "Draft (Belum Dipublish)"}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {v.status === "draft" && (
                      <>
                        <button
                          onClick={() => publish(v._id)}
                          disabled={isItemBusy || busy}
                          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg px-3 py-1.5 transition disabled:opacity-50"
                        >
                          {isItemBusy ? "Memproses..." : "✓ Publish"}
                        </button>
                        <button
                          onClick={() => hapusDraft(v._id)}
                          disabled={isItemBusy || busy}
                          className="text-xs bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-medium rounded-lg px-2.5 py-1.5 transition disabled:opacity-50"
                        >
                          {isItemBusy ? "..." : "🗑 Hapus Draft"}
                        </button>
                      </>
                    )}

                    {v.status === "aktif" && (
                      <button
                        onClick={() => unpublish(v._id)}
                        disabled={isItemBusy || busy}
                        className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-medium rounded-lg px-3 py-1.5 transition disabled:opacity-50"
                      >
                        {isItemBusy ? "Memproses..." : "↩ Batal Publish (Ke Draft)"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
