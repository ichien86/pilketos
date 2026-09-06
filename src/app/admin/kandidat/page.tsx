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
  const [uploadingInfo, setUploadingInfo] = useState<{ roleLabel: string; nomorLabel: string; targetName: string } | null>(null);
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
    const roleLabel = slot === "ketua" ? "Ketua" : "Wakil";
    const targetName = kandidatInfo?.nama ? `(${kandidatInfo.nama})` : "";
    const nomorLabel = kandidatInfo?.nomor ? `Paslon No. ${kandidatInfo.nomor}` : "Kandidat";

    setUploadingSlot(key);
    setUploadingInfo({ roleLabel, nomorLabel, targetName });
    setError(null);
    setSuccessMsg(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("slot", slot);
      await apiFetch(`/api/kandidat/${kandidatId}/foto`, { method: "POST", body });
      await refresh();
      setSuccessMsg(`Foto ${roleLabel} untuk ${nomorLabel} ${targetName} berhasil diunggah! Latar belakang telah dihapus otomatis dan avatar paslon telah diperbarui.`);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Gagal mengunggah foto. Pastikan format foto JPG, PNG, atau WEBP di bawah 8MB dan koneksi internet stabil."
      );
    } finally {
      setUploadingSlot(null);
      setUploadingInfo(null);
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
        <div className="fixed bottom-5 right-5 z-50 bg-slate-950 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3.5 border border-slate-700 ring-4 ring-amber-500/30 max-w-sm">
          <span className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0"></span>
          <div className="text-xs space-y-0.5">
            <p className="font-bold text-amber-300">Sedang memproses &amp; hapus background...</p>
            <p className="text-slate-200 text-[11px] truncate">
              {uploadingInfo ? `${uploadingInfo.roleLabel} - ${uploadingInfo.nomorLabel}` : "Memproses foto..."}
            </p>
            <p className="text-slate-400 text-[10px]">Tindakan lain dikunci sementara agar tidak bentrok.</p>
          </div>
        </div>
      )}

      {/* Banner Notifikasi Sedang Upload & Hapus Background */}
      {isUploading && (
        <div className="bg-amber-50 border-2 border-amber-400 text-amber-950 p-4 rounded-xl text-sm shadow-sm space-y-1.5 animate-pulse">
          <div className="flex items-center gap-2.5 font-bold text-amber-900">
            <span className="w-4 h-4 border-2 border-amber-700 border-t-transparent rounded-full animate-spin shrink-0"></span>
            <span>Sedang Memproses Foto &amp; Menghapus Background...</span>
          </div>
          <p className="text-xs text-amber-900 leading-relaxed">
            Sedang mengunggah <strong>{uploadingInfo ? `${uploadingInfo.roleLabel} untuk ${uploadingInfo.nomorLabel} ${uploadingInfo.targetName}` : "foto"}</strong>.
            Sistem AI sedang memotong latar belakang foto secara otomatis dengan kualitas asli. Harap tunggu beberapa saat...
          </p>
          <p className="text-[11px] text-amber-800 font-medium">
            🔒 Seluruh tindakan lain (unggah foto lain, tambah paslon, publish, hapus) dikunci sementara hingga proses selesai.
          </p>
        </div>
      )}

      {/* Banner Pesan Sukses */}
      {successMsg && (
        <div className="bg-emerald-50 border-2 border-emerald-500 text-emerald-950 p-4 rounded-xl text-sm font-medium shadow-sm flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-bold text-emerald-900 text-base">
              <span className="text-emerald-600 font-extrabold text-lg">✓</span>
              <span>Foto Berhasil Diunggah!</span>
            </div>
            <p className="text-xs text-emerald-800 leading-relaxed">{successMsg}</p>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-800 hover:text-emerald-950 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 font-bold transition shrink-0"
          >
            ✕ Tutup
          </button>
        </div>
      )}

      {/* Banner Pesan Gagal / Error */}
      {error && (
        <div className="bg-red-50 border-2 border-red-500 text-red-950 p-4 rounded-xl text-sm font-medium shadow-sm flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-red-900 text-base">
              <span className="text-red-600 font-extrabold text-lg">⚠️</span>
              <span>Gagal Mengunggah Foto</span>
            </div>
            <p className="text-xs text-red-800 font-semibold">{error}</p>
            <div className="text-[11px] text-red-700 bg-red-100/70 rounded-lg p-2.5 space-y-0.5">
              <p className="font-semibold">💡 Tips jika mengalami kendala upload:</p>
              <ul className="list-disc list-inside space-y-0.5 text-red-800">
                <li>Gunakan format gambar JPG, JPEG, PNG, atau WEBP.</li>
                <li>Ukuran file maksimal adalah 8 MB.</li>
                <li>Pastikan koneksi internet stabil saat proses mengunggah berlangsung.</li>
              </ul>
            </div>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-800 hover:text-red-950 text-xs px-2.5 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 font-bold transition shrink-0"
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
                          <span className="flex items-center gap-1.5 text-amber-700 font-semibold bg-amber-50 px-2 py-1 rounded border border-amber-200 animate-pulse">
                            <span className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin shrink-0"></span>
                            Hapus background...
                          </span>
                        ) : isUploading ? (
                          <span className="text-slate-400 italic">Terkunci (menunggu)</span>
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

