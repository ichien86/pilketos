"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/client-fetch";
import LogoutButton from "@/components/LogoutButton";

interface Video {
  _id: string;
  url: string;
  status: "draft" | "aktif";
}

// US-10 -- kandidat unggah video kampanye (draft) lalu publish sendiri.
export default function KandidatVideoPage() {
  const [videoList, setVideoList] = useState<Video[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const list = await apiFetch<Video[]>("/api/video");
    setVideoList(list);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      await apiFetch("/api/video", { method: "POST", body: form });
      setFile(null);
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal unggah");
    } finally {
      setBusy(false);
    }
  }

  async function publish(id: string) {
    setError(null);
    try {
      await apiFetch(`/api/video/${id}/publish`, { method: "POST" });
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal publish");
    }
  }

  return (
    <main className="min-h-screen p-4 max-w-lg mx-auto space-y-6">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-bold">Video Kampanye</h1>
        <LogoutButton />
      </header>

      <form onSubmit={upload} className="bg-white rounded-xl shadow p-4 space-y-3">
        <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={!file || busy} className="w-full bg-slate-900 text-white rounded-lg py-2 disabled:opacity-50">
          {busy ? "Mengunggah..." : "Unggah Video Baru"}
        </button>
      </form>

      <div className="space-y-3">
        {videoList.map((v) => (
          <div key={v._id} className="bg-white rounded-xl shadow p-4 space-y-2">
            <video src={v.url} controls className="w-full rounded-lg" />
            <div className="flex items-center justify-between">
              <span className={`text-xs px-2 py-1 rounded-full ${v.status === "aktif" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {v.status}
              </span>
              {v.status === "draft" && (
                <button onClick={() => publish(v._id)} className="text-sm bg-emerald-600 text-white rounded-lg px-3 py-1">
                  Publish
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
