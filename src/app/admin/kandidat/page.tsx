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
  has_akun?: boolean;
  username_akun?: string | null;
  video?: { _id: string; status: "draft" | "aktif"; url: string } | null;
}

const KOSONG = { nomor_urut: "", nama_ketua: "", nama_wakil: "", visi: "", misi: "" };

// US-06/07/08/09 -- CRUD kandidat, publish, batalkan, buat akun paslon.
export default function AdminKandidatPage() {
  const role = useRole();
  const isPengawas = role === "pengawas";
  const [list, setList] = useState<Kandidat[]>([]);
  const [form, setForm] = useState(KOSONG);
  const [error, setError] = useState<string | null>(null);
  const [akunInfo, setAkunInfo] = useState<{ username: string; password_sementara: string; is_reset?: boolean } | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null); // `${kandidatId}:${slot}`
  const [uploadingInfo, setUploadingInfo] = useState<{ roleLabel: string; nomorLabel: string; targetName: string } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [busyVideoId, setBusyVideoId] = useState<string | null>(null);

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

  async function buatAtauResetAkun(id: string, isReset: boolean = false, labelPaslon: string = "") {
    if (isUploading) return;
    if (isReset && !confirm(`Reset password akun paslon untuk ${labelPaslon}? Password lama akan diganti dengan password sementara yang baru.`)) {
      return;
    }
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetch<{ username: string; password_sementara: string; is_reset?: boolean }>(
        `/api/kandidat/${id}/akun`,
        { method: "POST" }
      );
      setAkunInfo(res);
      if (res.is_reset) {
        setSuccessMsg(`✓ Password akun paslon (${res.username}) berhasil direset! Kredensial baru ditampilkan di kotak kuning di bawah.`);
      } else {
        setSuccessMsg(`✓ Akun paslon (${res.username}) berhasil dibuat! Kredensial ditampilkan di kotak kuning di bawah.`);
      }
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal memproses akun paslon");
    }
  }

  async function publishVideo(videoId: string, nomor: number) {
    if (isUploading || busyVideoId) return;
    if (!confirm(`Publikasikan video kampanye untuk Paslon No. ${nomor}?`)) return;
    setBusyVideoId(videoId);
    setError(null);
    setSuccessMsg(null);
    try {
      await apiFetch(`/api/video/${videoId}/publish`, { method: "POST" });
      setSuccessMsg(`✓ Video Paslon No. ${nomor} berhasil dipublish (status aktif)!`);
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal mempublikasikan video");
    } finally {
      setBusyVideoId(null);
    }
  }

  async function unpublishVideo(videoId: string, nomor: number) {
    if (isUploading || busyVideoId) return;
    if (!confirm(`Batalkan publish video Paslon No. ${nomor}? Status video akan kembali ke draft dan tidak dapat ditonton pemilih.`)) return;
    setBusyVideoId(videoId);
    setError(null);
    setSuccessMsg(null);
    try {
      await apiFetch(`/api/video/${videoId}/unpublish`, { method: "POST" });
      setSuccessMsg(`✓ Publish video Paslon No. ${nomor} berhasil dibatalkan (kembali ke draft)!`);
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal membatalkan publish video");
    } finally {
      setBusyVideoId(null);
    }
  }

  async function hapusVideoDraft(videoId: string, nomor: number) {
    if (isUploading || busyVideoId) return;
    if (!confirm(`Hapus video draft Paslon No. ${nomor}? File video fisik di server akan dihapus permanen.`)) return;
    setBusyVideoId(videoId);
    setError(null);
    setSuccessMsg(null);
    try {
      await apiFetch(`/api/video/${videoId}`, { method: "DELETE" });
      setSuccessMsg(`✓ Video draft Paslon No. ${nomor} berhasil dihapus dari sistem dan server!`);
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menghapus video draft");
    } finally {
      setBusyVideoId(null);
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
        <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 text-sm text-amber-950 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-bold flex items-center gap-1.5">
              <span>🔑</span>
              <span>Kredensial Akun Paslon {akunInfo.is_reset ? "(Setelah Reset)" : "(Baru Dibuat)"}</span>
            </span>
            <button
              onClick={() => setAkunInfo(null)}
              className="text-amber-800 hover:text-amber-950 text-xs px-2 py-1 rounded bg-amber-100 font-bold transition"
            >
              ✕ Tutup
            </button>
          </div>
          <p className="text-xs text-amber-900">
            Username: <b>{akunInfo.username}</b> &nbsp;|&nbsp; Password Sementara: <span className="font-mono bg-white px-2 py-0.5 rounded border border-amber-300 font-bold select-all">{akunInfo.password_sementara}</span>
          </p>
          <p className="text-[11px] text-amber-800 italic">
            Salin atau catat username &amp; password sementara ini dan berikan kepada pasangan calon untuk login.
          </p>
        </div>
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

            {/* Monitoring & Kontrol Video Kampanye Paslon */}
            <div className="bg-slate-50 rounded-lg p-3 text-xs border border-slate-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">
                    {k.video?.status === "aktif" ? "🟢" : k.video?.status === "draft" ? "🟡" : "⚪"}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-800">
                      {k.video?.status === "aktif"
                        ? "Video Kampanye: Sudah Terbit (Aktif)"
                        : k.video?.status === "draft"
                        ? "Video Kampanye: Draft (Belum Dipublish)"
                        : "Video Kampanye: Belum Diunggah oleh Paslon"}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {k.has_akun
                        ? `Akun login paslon: ${k.username_akun || `paslon${k.nomor_urut}`}`
                        : "Akun login paslon belum dibuat"}
                    </p>
                  </div>
                </div>
                {k.video && (
                  <a
                    href={k.video.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-md text-blue-600 font-medium shrink-0 flex items-center gap-1 shadow-sm"
                  >
                    ▶ Tonton Video
                  </a>
                )}
              </div>

              {/* Tombol Aksi Video untuk Panitia / Admin */}
              {!isPengawas && k.video && (
                <div className="flex items-center gap-2 pt-1.5 border-t border-slate-200">
                  {k.video.status === "draft" && (
                    <>
                      <button
                        onClick={() => publishVideo(k.video!._id, k.nomor_urut)}
                        disabled={busyVideoId === k.video._id || isUploading}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium disabled:opacity-50 transition"
                      >
                        {busyVideoId === k.video._id ? "Memproses..." : "✓ Publish Video"}
                      </button>
                      <button
                        onClick={() => hapusVideoDraft(k.video!._id, k.nomor_urut)}
                        disabled={busyVideoId === k.video._id || isUploading}
                        className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded font-medium disabled:opacity-50 transition"
                      >
                        {busyVideoId === k.video._id ? "Memproses..." : "🗑 Hapus Draft"}
                      </button>
                    </>
                  )}
                  {k.video.status === "aktif" && (
                    <button
                      onClick={() => unpublishVideo(k.video!._id, k.nomor_urut)}
                      disabled={busyVideoId === k.video._id || isUploading}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded font-medium disabled:opacity-50 transition"
                    >
                      {busyVideoId === k.video._id ? "Memproses..." : "↩ Batal Publish (Ke Draft)"}
                    </button>
                  )}
                </div>
              )}
            </div>

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
                      onClick={() =>
                        buatAtauResetAkun(
                          k._id,
                          Boolean(k.has_akun),
                          `No. ${k.nomor_urut} (${k.nama_ketua} & ${k.nama_wakil})`
                        )
                      }
                      disabled={isUploading}
                      className={`text-sm rounded-lg px-3 py-1.5 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
                        k.has_akun
                          ? "bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300"
                          : "border hover:bg-slate-50 text-slate-800"
                      }`}
                    >
                      {k.has_akun ? "🔑 Reset Password Akun" : "➕ Buat Akun Paslon"}
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

