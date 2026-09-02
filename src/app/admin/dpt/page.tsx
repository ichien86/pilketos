"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, ApiError } from "@/lib/client-fetch";
import { useRole } from "@/lib/use-role";
import PanitiaNav from "@/components/PanitiaNav";

interface Ringkasan {
  total_baris_siswa: number;
  total_baris_guru: number;
  valid: number;
  error: number;
  detail_error: Array<{ jenis: string; baris: number; pesan: string }>;
  ter_commit?: number;
}

interface Pemilih {
  _id: string;
  jenis: "siswa" | "guru";
  nis_nip: string;
  nama: string;
  kelas: string | null;
  pangkat: string | null;
  tanggal_lahir: string;
  aktivasi_selesai: boolean;
  sosialisasi_ditonton: number;
  sosialisasi_wajib: number;
  memenuhi_syarat: boolean | null;
  sudah_memilih?: boolean;
}

const FORM_KOSONG = { jenis: "siswa" as "siswa" | "guru", nis_nip: "", nama: "", kelas_pangkat: "", tanggal_lahir: "" };

// US-01 -- import DPT (dry-run lalu commit) + CRUD manual per pemilih + US-04 reset password.
export default function AdminDptPage() {
  const role = useRole();
  const isPengawas = role === "pengawas";
  const [file, setFile] = useState<File | null>(null);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [resetUsername, setResetUsername] = useState("");
  const [resetResult, setResetResult] = useState<{ username: string; password_sementara: string } | null>(null);

  const [pemilihList, setPemilihList] = useState<Pemilih[]>([]);
  const [cari, setCari] = useState("");
  const cariInputRef = useRef<HTMLInputElement>(null);
  const [filterKelas, setFilterKelas] = useState("");
  const [filterStatus, setFilterStatus] = useState<"semua" | "belum_aktivasi" | "belum_sosialisasi" | "sudah_memilih" | "belum_memilih">("semua");
  const [tambahForm, setTambahForm] = useState(FORM_KOSONG);
  const [tambahError, setTambahError] = useState<string | null>(null);
  const [tambahBusy, setTambahBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(FORM_KOSONG);
  const [editError, setEditError] = useState<string | null>(null);

  async function refreshPemilih() {
    setPemilihList(await apiFetch<Pemilih[]>("/api/dpt"));
  }

  useEffect(() => {
    refreshPemilih();
    const id = setInterval(refreshPemilih, 5000);
    return () => clearInterval(id);
  }, []);

  // Aksesibilitas: tekan "/" di mana saja di halaman untuk lompat ke kotak
  // cari, tanpa perlu mengarahkan mouse -- pola umum (mis. GitHub, Slack).
  // Diabaikan kalau sedang mengetik di field lain supaya tidak mengganggu
  // input yang kebetulan butuh karakter "/".
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const sedangMengetik =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || target?.isContentEditable;
      if (sedangMengetik) return;
      e.preventDefault();
      cariInputRef.current?.focus();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const daftarKelas = useMemo(() => {
    const set = new Set(pemilihList.map((p) => p.kelas).filter((k): k is string => !!k));
    return Array.from(set).sort();
  }, [pemilihList]);

  const listTersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return pemilihList.filter((p) => {
      const cocokCari = !q || p.nama.toLowerCase().includes(q) || p.nis_nip.includes(q) || (p.kelas ?? p.pangkat ?? "").toLowerCase().includes(q);
      const cocokKelas = !filterKelas || (filterKelas === "__guru__" ? p.jenis === "guru" : p.kelas === filterKelas);
      const cocokStatus =
        filterStatus === "semua" ||
        (filterStatus === "belum_aktivasi" && !p.aktivasi_selesai) ||
        (filterStatus === "belum_sosialisasi" && p.memenuhi_syarat === false) ||
        (filterStatus === "sudah_memilih" && p.sudah_memilih) ||
        (filterStatus === "belum_memilih" && !p.sudah_memilih);
      return cocokCari && cocokKelas && cocokStatus;
    });
  }, [pemilihList, cari, filterKelas, filterStatus]);

  const jumlahBelumAktivasi = useMemo(() => pemilihList.filter((p) => !p.aktivasi_selesai).length, [pemilihList]);
  const jumlahBelumSosialisasi = useMemo(() => pemilihList.filter((p) => p.memenuhi_syarat === false).length, [pemilihList]);
  const jumlahSudahMemilih = useMemo(() => pemilihList.filter((p) => p.sudah_memilih).length, [pemilihList]);
  const jumlahBelumMemilih = useMemo(() => pemilihList.filter((p) => !p.sudah_memilih).length, [pemilihList]);

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
      if (mode === "commit") refreshPemilih();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal memproses file");
    } finally {
      setBusy(false);
    }
  }

  async function tambahPemilih(e: React.FormEvent) {
    e.preventDefault();
    setTambahError(null);
    setTambahBusy(true);
    try {
      await apiFetch("/api/dpt", { method: "POST", body: JSON.stringify(tambahForm) });
      setTambahForm(FORM_KOSONG);
      refreshPemilih();
    } catch (e) {
      setTambahError(e instanceof ApiError ? e.message : "Gagal menambah pemilih");
    } finally {
      setTambahBusy(false);
    }
  }

  function mulaiEdit(p: Pemilih) {
    setEditId(p._id);
    setEditError(null);
    setEditForm({
      jenis: p.jenis,
      nis_nip: p.nis_nip,
      nama: p.nama,
      kelas_pangkat: p.kelas ?? p.pangkat ?? "",
      tanggal_lahir: p.tanggal_lahir,
    });
  }

  async function simpanEdit(id: string) {
    setEditError(null);
    try {
      await apiFetch(`/api/dpt/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          nis_nip: editForm.nis_nip,
          nama: editForm.nama,
          kelas_pangkat: editForm.kelas_pangkat,
          tanggal_lahir: editForm.tanggal_lahir,
        }),
      });
      setEditId(null);
      refreshPemilih();
    } catch (e) {
      setEditError(e instanceof ApiError ? e.message : "Gagal menyimpan perubahan");
    }
  }

  async function hapusPemilih(p: Pemilih) {
    if (!confirm(`Hapus data pemilih "${p.nama}" (${p.nis_nip})?`)) return;
    setError(null);
    try {
      await apiFetch(`/api/dpt/${p._id}`, { method: "DELETE" });
      refreshPemilih();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menghapus pemilih");
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
    <main className="min-h-screen p-4 max-w-3xl mx-auto space-y-6">
      <header className={role === "panitia" ? "space-y-2 pt-2" : "flex items-center justify-between pt-2"}>
        <h1 className="text-lg font-bold">Data Pemilih Tetap (DPT)</h1>
        {role === "panitia" ? (
          <PanitiaNav active="/admin/dpt" />
        ) : (
          <a href={role === "admin" ? "/admin/fase" : "/pengawas"} className="text-sm text-blue-600 hover:underline">Kembali</a>
        )}
      </header>

      {isPengawas && (
        <p className="text-sm bg-slate-100 text-slate-500 rounded-lg p-3">
          Akses pengawas: hanya bisa melihat data, tidak bisa mengubah apa pun di halaman ini.
        </p>
      )}

      {!isPengawas && (
      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-bold">Import dari Excel</h2>
        <p className="text-sm text-slate-600">
          File Excel dengan sheet <code>Siswa</code> (NIS, Nama, Kelas, Tanggal Lahir) dan <code>Guru</code> (NIP, Nama, Pangkat, Tanggal Lahir).
        </p>
        <p className="text-xs text-slate-400">
          Baris dengan NIS/NIP yang sudah terdaftar (baik duplikat di dalam file maupun sudah ada di database) akan ditolak dan dilaporkan sebagai error -- tidak menimpa data yang sudah ada. Untuk mengoreksi data yang sudah ada, pakai Edit di tabel di bawah.
        </p>
        <p className="text-xs text-slate-400">
          Tanggal lahir angka seperti &quot;9/12/1986&quot; (hari &amp; bulan sama-sama &le;12) ambigu dan akan ditolak -- tulis pakai nama bulan (&quot;9 Desember 1986&quot;) atau format ISO (1986-12-09) supaya jelas.
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
      )}

      {!isPengawas && (
      <form onSubmit={tambahPemilih} className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-bold">Tambah Pemilih Manual</h2>
        <div className="grid grid-cols-2 gap-2">
          <select
            className="border rounded-lg px-3 py-2"
            value={tambahForm.jenis}
            onChange={(e) => setTambahForm({ ...tambahForm, jenis: e.target.value as "siswa" | "guru" })}
          >
            <option value="siswa">Siswa</option>
            <option value="guru">Guru</option>
          </select>
          <input
            className="border rounded-lg px-3 py-2"
            placeholder={tambahForm.jenis === "siswa" ? "NIS" : "NIP"}
            value={tambahForm.nis_nip}
            onChange={(e) => setTambahForm({ ...tambahForm, nis_nip: e.target.value })}
            required
          />
          <input
            className="border rounded-lg px-3 py-2 col-span-2"
            placeholder="Nama"
            value={tambahForm.nama}
            onChange={(e) => setTambahForm({ ...tambahForm, nama: e.target.value })}
            required
          />
          <input
            className="border rounded-lg px-3 py-2"
            placeholder={tambahForm.jenis === "siswa" ? "Kelas" : "Pangkat"}
            value={tambahForm.kelas_pangkat}
            onChange={(e) => setTambahForm({ ...tambahForm, kelas_pangkat: e.target.value })}
            required
          />
          <input
            type="date"
            className="border rounded-lg px-3 py-2"
            value={tambahForm.tanggal_lahir}
            onChange={(e) => setTambahForm({ ...tambahForm, tanggal_lahir: e.target.value })}
            required
          />
        </div>
        {tambahError && <p className="text-red-600 text-sm">{tambahError}</p>}
        <button type="submit" disabled={tambahBusy} className="w-full bg-slate-900 text-white rounded-lg py-2 disabled:opacity-50">
          Tambah
        </button>
      </form>
      )}

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-bold">Daftar Pemilih ({listTersaring.length}/{pemilihList.length})</h2>
          <div className="relative">
            <input
              ref={cariInputRef}
              className="border rounded-lg pl-3 pr-7 py-1.5 text-sm"
              placeholder="Cari nama/NIS/NIP/kelas..."
              value={cari}
              onChange={(e) => setCari(e.target.value)}
            />
            {!cari && (
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 border border-slate-300 rounded px-1 pointer-events-none">
                /
              </kbd>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <button
            onClick={() => setFilterStatus(filterStatus === "belum_aktivasi" ? "semua" : "belum_aktivasi")}
            className={`rounded-lg px-3 py-2 text-left ${filterStatus === "belum_aktivasi" ? "bg-slate-900 text-white" : "bg-slate-100"}`}
          >
            <div className="font-bold text-sm">{jumlahBelumAktivasi}</div>
            <div>belum aktivasi</div>
          </button>
          <button
            onClick={() => setFilterStatus(filterStatus === "belum_sosialisasi" ? "semua" : "belum_sosialisasi")}
            className={`rounded-lg px-3 py-2 text-left ${filterStatus === "belum_sosialisasi" ? "bg-slate-900 text-white" : "bg-slate-100"}`}
          >
            <div className="font-bold text-sm">{jumlahBelumSosialisasi}</div>
            <div>belum sosialisasi</div>
          </button>
          <button
            onClick={() => setFilterStatus(filterStatus === "sudah_memilih" ? "semua" : "sudah_memilih")}
            className={`rounded-lg px-3 py-2 text-left ${filterStatus === "sudah_memilih" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-800"}`}
          >
            <div className="font-bold text-sm">{jumlahSudahMemilih}</div>
            <div>sudah memilih</div>
          </button>
          <button
            onClick={() => setFilterStatus(filterStatus === "belum_memilih" ? "semua" : "belum_memilih")}
            className={`rounded-lg px-3 py-2 text-left ${filterStatus === "belum_memilih" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-800"}`}
          >
            <div className="font-bold text-sm">{jumlahBelumMemilih}</div>
            <div>belum memilih</div>
          </button>
        </div>

        {(daftarKelas.length > 0 || pemilihList.some((p) => p.jenis === "guru")) && (
          <select className="border rounded-lg px-3 py-1.5 text-sm" value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)}>
            <option value="">Semua kelas</option>
            {daftarKelas.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
            {pemilihList.some((p) => p.jenis === "guru") && <option value="__guru__">Guru</option>}
          </select>
        )}

        <div className="divide-y max-h-[32rem] overflow-y-auto">
          {listTersaring.map((p) => (
            <div key={p._id} className="py-2.5 text-sm">
              {editId === p._id && !isPengawas ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="border rounded-lg px-2 py-1"
                      placeholder={p.jenis === "siswa" ? "NIS" : "NIP"}
                      value={editForm.nis_nip}
                      onChange={(e) => setEditForm({ ...editForm, nis_nip: e.target.value })}
                    />
                    <input
                      className="border rounded-lg px-2 py-1"
                      placeholder="Nama"
                      value={editForm.nama}
                      onChange={(e) => setEditForm({ ...editForm, nama: e.target.value })}
                    />
                    <input
                      className="border rounded-lg px-2 py-1"
                      placeholder={p.jenis === "siswa" ? "Kelas" : "Pangkat"}
                      value={editForm.kelas_pangkat}
                      onChange={(e) => setEditForm({ ...editForm, kelas_pangkat: e.target.value })}
                    />
                    <input
                      type="date"
                      className="border rounded-lg px-2 py-1"
                      value={editForm.tanggal_lahir}
                      onChange={(e) => setEditForm({ ...editForm, tanggal_lahir: e.target.value })}
                    />
                  </div>
                  {editError && <p className="text-red-600 text-xs">{editError}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => simpanEdit(p._id)} className="text-xs bg-emerald-600 text-white rounded-lg px-3 py-1">Simpan</button>
                    <button onClick={() => setEditId(null)} className="text-xs border rounded-lg px-3 py-1">Batal</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{p.nama} <span className="text-slate-400 font-normal">-- {p.nis_nip}</span></p>
                    <p className="text-slate-400 text-xs">
                      {p.jenis === "siswa" ? p.kelas : p.pangkat} &middot; lahir {p.tanggal_lahir} &middot;{" "}
                      {p.aktivasi_selesai ? <span className="text-emerald-600">sudah aktivasi</span> : <span>belum aktivasi</span>}
                      {" "}&middot;{" "}
                      {p.memenuhi_syarat === null ? (
                        <span>sosialisasi belum dibuka</span>
                      ) : p.memenuhi_syarat ? (
                        <span className="text-emerald-600">memenuhi syarat ({p.sosialisasi_ditonton}/{p.sosialisasi_wajib} video)</span>
                      ) : (
                        <span className="text-amber-600">belum memenuhi syarat ({p.sosialisasi_ditonton}/{p.sosialisasi_wajib} video)</span>
                      )}
                    </p>
                  </div>
                  {!isPengawas && (
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => mulaiEdit(p)} className="text-xs text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => hapusPemilih(p)} className="text-xs text-red-600 hover:underline">Hapus</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {listTersaring.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">Belum ada data pemilih.</p>}
        </div>
      </div>

      {!isPengawas && (
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
      )}
    </main>
  );
}
