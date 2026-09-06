"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/client-fetch";
import CandidateAvatar from "@/components/CandidateAvatar";
import { useRole } from "@/lib/use-role";
import PanitiaNav from "@/components/PanitiaNav";

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

const KOSONG = { nomor_urut: "", nama_ketua: "", nama_wakil: "", visi: "", misi: "" };

// US-06/07/08/09 -- CRUD kandidat, publish, batalkan, buat akun paslon.
export default function AdminKandidatPage() {
  const role = useRole();
  const isPengawas = role === "pengawas";
  const [list, setList] = useState<Kandidat[]>([]);
  const [form, setForm] = useState(KOSONG);
  const [error, setError] = useState<string | null>(null);
  const [akunInfo, setAkunInfo] = useState<{ username: string; password_sementara: string } | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null); // `${kandidatId}:${slot}`
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isUploading = uploadingSlot !== null;

  async function refresh() {
    setList(await apiFetch<Kandidat[]>("/api/kandidat"));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    if (isUploading) return;
    setError(null);
    setSuccessMsg(null);
    try {
      await apiFetch("/api/kandidat", {
        method: "POST",
        body: JSON.stringify({ ...form, nomor_urut: Number(form.nomor_urut) }),
      });
      setForm(KOSONG);
      setSuccessMsg(`✓ Berhasil menambahkan kandidat No. ${form.nomor_urut}`);
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menambah kandidat");
    }
  }

  async function uploadFoto(
    kandidatId: string,
    slot: "ketua" | "wakil",
    file: File,
    kandidatInfo?: { nomor: number; nama: string }
  ) {
    if (isUploading) return;
    const key = `${kandidatId}:${slot}`;
    setUploadingSlot(key);
    setError(null);
    setSuccessMsg(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("slot", slot);
      await apiFetch(`/api/kandidat/${kandidatId}/foto`, { method: "POST", body });
      await refresh();
      const roleLabel = slot === "ketua" ? "Ketua" : "Wakil";
      const targetName = kandidatInfo?.nama ? `(${kandidatInfo.nama})` : "";
      const nomorLabel = kandidatInfo?.nomor ? `Paslon No. ${kandidatInfo.nomor}` : "kandidat";
      setSuccessMsg(`✓ Foto ${roleLabel} untuk ${nomorLabel} ${targetName} berhasil diunggah dan diperbarui!`);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? `Gagal mengunggah foto: ${e.message}`
          : "Gagal mengunggah foto. Silakan periksa koneksi internet atau gunakan file foto lain."
      );
    } finally {
      setUploadingSlot(null);
    }
  }

  async function publish(id: string) {
    if (isUploading) return;
    setError(null);
    setSuccessMsg(null);
    try {
      await apiFetch(`/api/kandidat/${id}/publish`, { method: "POST" });
      setSuccessMsg("✓ Kandidat berhasil dipublish!");
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal publish");
    }
  }

  async function batalkan(id: string) {
    if (isUploading) return;
    if (!confirm("Batalkan paslon ini?")) return;
    setError(null);
    setSuccessMsg(null);
    try {
      await apiFetch(`/api/kandidat/${id}/batalkan`, { method: "POST" });
      setSuccessMsg("✓ Paslon berhasil dibatalkan.");
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal membatalkan");
    }
  }

  async function buatAkun(id: string) {
    if (isUploading) return;
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetch<{ username: string; password_sementara: string }>(`/api/kandidat/${id}/akun`, { method: "POST" });
      setAkunInfo(res);
      setSuccessMsg("✓ Akun paslon berhasil dibuat!");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal membuat akun");
    }
  }

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto space-y-6">
      <header className={role === "panitia" ? "space-y-2 pt-2" : "flex items-center justify-between pt-2"}>
        <h1 className="text-lg font-bold">Kandidat</h1>
        {role === "panitia" ? (
          <PanitiaNav active="/admin/kandidat" />
        ) : (
          <a href={role === "admin" ? "/admin/fase" : "/pengawas"} className="text-sm text-blue-600 hover:underline">Kembali</a>
        )}
      </header>

      {/* Floating Indicator saat Sedang Upload Foto (Mengunci Tindakan Lain) */}
      {isUploading && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 ring-2 ring-blue-500/40">
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0"></span>
          <div className="text-xs">
            <p className="font-bold">Sedang memproses &amp; mengunggah foto...</p>
            <p className="text-slate-400 text-[11px]">Tindakan lain dikunci sementara agar proses tidak bentrok.</p>
          </div>
        </div>
      )}

      {/* Banner Pesan Sukses */}
      {successMsg && (
        <div className="bg-emerald-50 border-2 border-emerald-400 text-emerald-950 px-4 py-3 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-base">🎉</span>
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-800 hover:text-emerald-950 text-xs px-2 py-1 rounded bg-emerald-100 font-bold transition"
          >
            ✕ Tutup
          </button>
        </div>
      )}

      {/* Banner Pesan Gagal / Error */}
      {error && (
        <div className="bg-red-50 border-2 border-red-400 text-red-950 px-4 py-3 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-base">⚠️</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-800 hover:text-red-950 text-xs px-2 py-1 rounded bg-red-100 font-bold transition"
          >
            ✕ Tutup
          </button>
        </div>
      )}

      {isPengawas && (
        <p className="text-sm bg-slate-100 text-slate-500 rounded-lg p-3">
          Akses pengawas: hanya bisa melihat data, tidak bisa mengubah apa pun di halaman ini.
        </p>
      )}

      {!isPengawas && (
      <form onSubmit={tambah} className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-bold">Tambah Kandidat (draft)</h2>
        <p className="text-xs text-slate-400">Foto diunggah belakangan di kartu kandidat di bawah, setelah kandidatnya dibuat.</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            className="border rounded-lg px-3 py-2 disabled:bg-slate-100 disabled:cursor-not-allowed"
            placeholder="Nomor urut"
            value={form.nomor_urut}
            disabled={isUploading}
            onChange={(e) => setForm({ ...form, nomor_urut: e.target.value })}
            required
          />
          <div />
          <input
            className="border rounded-lg px-3 py-2 disabled:bg-slate-100 disabled:cursor-not-allowed"
            placeholder="Nama Ketua"
            value={form.nama_ketua}
            disabled={isUploading}
            onChange={(e) => setForm({ ...form, nama_ketua: e.target.value })}
          />
          <input
            className="border rounded-lg px-3 py-2 disabled:bg-slate-100 disabled:cursor-not-allowed"
            placeholder="Nama Wakil"
            value={form.nama_wakil}
            disabled={isUploading}
            onChange={(e) => setForm({ ...form, nama_wakil: e.target.value })}
          />
        </div>
        <textarea
          className="w-full border rounded-lg px-3 py-2 disabled:bg-slate-100 disabled:cursor-not-allowed"
          placeholder="Visi"
          value={form.visi}
          disabled={isUploading}
          onChange={(e) => setForm({ ...form, visi: e.target.value })}
        />
        <div>
          <textarea
            className="w-full border rounded-lg px-3 py-2 disabled:bg-slate-100 disabled:cursor-not-allowed"
            placeholder={"Misi\nSatu poin per baris, contoh:\nMengadakan program mentoring lintas angkatan\nMembuka kanal aspirasi digital"}
            rows={4}
            value={form.misi}
            disabled={isUploading}
            onChange={(e) => setForm({ ...form, misi: e.target.value })}
          />
          <p className="text-xs text-slate-400 mt-1">Tekan Enter di antar poin -- akan ditampilkan bernomor otomatis ke pemilih.</p>
        </div>
        <button
          type="submit"
          disabled={isUploading}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-lg py-2 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Tambah
        </button>
      </form>
      )}

      {akunInfo && !isPengawas && (
        <p className="text-sm bg-amber-50 rounded-lg p-3">
          Akun paslon dibuat: <b>{akunInfo.username}</b> / password sementara: <span className="font-mono">{akunInfo.password_sementara}</span>
        </p>
      )}

      <div className="space-y-3">
        {list.map((k) => (
          <div key={k._id} className="bg-white rounded-xl shadow p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">No. {k.nomor_urut} -- {k.nama_ketua} &amp; {k.nama_wakil}</h3>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  k.status === "aktif" ? "bg-emerald-100 text-emerald-700" : k.status === "dibatalkan" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {k.status}
              </span>
            </div>

            {k.status === "draft" && !isPengawas && (
              <div className="grid grid-cols-2 gap-3">
                {(["ketua", "wakil"] as const).map((slot) => {
                  const nama = slot === "ketua" ? k.nama_ketua : k.nama_wakil;
                  const foto = slot === "ketua" ? k.foto_ketua : k.foto_wakil;
                  const key = `${k._id}:${slot}`;
                  const busy = uploadingSlot === key;
                  return (
                    <div key={slot} className="flex items-center gap-3">
                      <CandidateAvatar nama={nama || "?"} foto={foto} size={56} />
                      <label
                        className={`text-xs flex flex-col ${
                          isUploading
                            ? "opacity-50 cursor-not-allowed pointer-events-none"
                            : "text-blue-600 hover:underline cursor-pointer"
                        }`}
                      >
                        {busy ? (
                          <span className="flex items-center gap-1.5 text-blue-600 font-semibold animate-pulse">
                            <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                            Memproses...
                          </span>
                        ) : isUploading ? (
                          <span className="text-slate-400">Tunggu proses...</span>
                        ) : foto ? (
                          "Ganti foto"
                        ) : (
                          "Unggah foto"
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={isUploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadFoto(k._id, slot, file, { nomor: k.nomor_urut, nama: nama || "" });
                            e.target.value = "";
                          }}
                        />
                        <div className="text-slate-400 font-normal">{slot === "ketua" ? "Ketua" : "Wakil"}</div>
                      </label>
                    </div>
                  );
                })}
              </div>
            )}

            {!isPengawas && (
              <div className="flex gap-2 flex-wrap">
                {k.status === "draft" && (
                  <button
                    onClick={() => publish(k._id)}
                    disabled={isUploading}
                    className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-1.5 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Publish
                  </button>
                )}
                {k.status === "aktif" && (
                  <>
                    <button
                      onClick={() => batalkan(k._id)}
                      disabled={isUploading}
                      className="text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 py-1.5 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Batalkan
                    </button>
                    <button
                      onClick={() => buatAkun(k._id)}
                      disabled={isUploading}
                      className="text-sm border rounded-lg px-3 py-1.5 font-medium transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Buat Akun Paslon
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

