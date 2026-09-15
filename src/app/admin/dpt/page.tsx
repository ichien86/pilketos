"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, ApiError } from "@/lib/client-fetch";
import { useRole } from "@/lib/use-role";
import PanitiaNav from "@/components/PanitiaNav";
import { exportDptToExcel, exportDptToPdf } from "@/lib/dpt-export";

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
  status_pemilihan?: "belum_memilih" | "belum_scan_keluar" | "selesai";
  selesai_coblos_at?: string | null;
  menit_sejak_coblos?: number;
  bisa_ubah_manual?: boolean;
  alasan_keluar_manual?: string | null;
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
  const [filterStatus, setFilterStatus] = useState<"semua" | "belum_aktivasi" | "belum_sosialisasi" | "sudah_memilih" | "belum_scan_keluar" | "belum_memilih">("semua");
  const [tambahForm, setTambahForm] = useState(FORM_KOSONG);
  const [tambahError, setTambahError] = useState<string | null>(null);
  const [tambahBusy, setTambahBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(FORM_KOSONG);
  const [editError, setEditError] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState<"excel" | "pdf" | null>(null);

  // State Modal Verifikasi Keluar Manual
  const [modalKeluarTarget, setModalKeluarTarget] = useState<Pemilih | null>(null);
  const [alasanKeluar, setAlasanKeluar] = useState("Kendala teknis device / HP mati");
  const [detailAlasanLainnya, setDetailAlasanLainnya] = useState("");
  const [busyKeluarManual, setBusyKeluarManual] = useState(false);
  const [errorKeluarManual, setErrorKeluarManual] = useState<string | null>(null);
  const [successKeluarManual, setSuccessKeluarManual] = useState<string | null>(null);

  function bukaModalKeluarManual(p: Pemilih) {
    setModalKeluarTarget(p);
    setAlasanKeluar("Kendala teknis device / HP mati");
    setDetailAlasanLainnya("");
    setErrorKeluarManual(null);
  }

  async function handleSimpanKeluarManual(e: React.FormEvent) {
    e.preventDefault();
    if (!modalKeluarTarget || busyKeluarManual) return;
    setBusyKeluarManual(true);
    setErrorKeluarManual(null);
    try {
      await apiFetch("/api/panitia/exit-scan/manual", {
        method: "POST",
        body: JSON.stringify({
          pemilihId: modalKeluarTarget._id,
          alasan: alasanKeluar,
          detailAlasan: detailAlasanLainnya,
        }),
      });
      setSuccessKeluarManual(`✓ Berhasil memverifikasi keluar manual untuk ${modalKeluarTarget.nama}`);
      setModalKeluarTarget(null);
      await refreshPemilih();
    } catch (err) {
      setErrorKeluarManual(err instanceof ApiError ? err.message : "Gagal memverifikasi keluar manual");
    } finally {
      setBusyKeluarManual(false);
    }
  }

  async function handleExportExcel() {
    if (listTersaring.length === 0) return;
    setExportBusy("excel");
    setError(null);
    try {
      await exportDptToExcel(listTersaring, filterStatus, filterKelas, cari);
    } catch (err) {
      console.error("Gagal ekspor Excel:", err);
      setError("Gagal mengekspor data ke Excel");
    } finally {
      setExportBusy(null);
    }
  }

  async function handleExportPdf() {
    if (listTersaring.length === 0) return;
    setExportBusy("pdf");
    setError(null);
    try {
      await exportDptToPdf(listTersaring, filterStatus, filterKelas, cari);
    } catch (err) {
      console.error("Gagal ekspor PDF:", err);
      setError("Gagal mengekspor data ke PDF");
    } finally {
      setExportBusy(null);
    }
  }

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
        (filterStatus === "sudah_memilih" && (p.sudah_memilih || p.status_pemilihan === "selesai")) ||
        (filterStatus === "belum_scan_keluar" && p.status_pemilihan === "belum_scan_keluar") ||
        (filterStatus === "belum_memilih" && (!p.sudah_memilih && p.status_pemilihan !== "belum_scan_keluar" && p.status_pemilihan !== "selesai"));
      return cocokCari && cocokKelas && cocokStatus;
    });
  }, [pemilihList, cari, filterKelas, filterStatus]);

  const jumlahBelumAktivasi = useMemo(() => pemilihList.filter((p) => !p.aktivasi_selesai).length, [pemilihList]);
  const jumlahBelumSosialisasi = useMemo(() => pemilihList.filter((p) => p.memenuhi_syarat === false).length, [pemilihList]);
  const jumlahSudahMemilih = useMemo(() => pemilihList.filter((p) => p.sudah_memilih || p.status_pemilihan === "selesai").length, [pemilihList]);
  const jumlahBelumScanKeluar = useMemo(() => pemilihList.filter((p) => p.status_pemilihan === "belum_scan_keluar").length, [pemilihList]);
  const jumlahBelumMemilih = useMemo(() => pemilihList.filter((p) => !p.sudah_memilih && p.status_pemilihan !== "belum_scan_keluar" && p.status_pemilihan !== "selesai").length, [pemilihList]);

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

        {/* Banner Pesan Sukses Verifikasi Keluar Manual */}
        {successKeluarManual && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 p-3 rounded-lg text-xs flex items-center justify-between shadow-sm">
            <span>{successKeluarManual}</span>
            <button
              onClick={() => setSuccessKeluarManual(null)}
              className="text-emerald-800 hover:text-emerald-950 font-bold ml-2 text-sm"
            >
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
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
            onClick={() => setFilterStatus(filterStatus === "belum_scan_keluar" ? "semua" : "belum_scan_keluar")}
            className={`rounded-lg px-3 py-2 text-left border transition ${
              filterStatus === "belum_scan_keluar"
                ? "bg-amber-600 text-white border-amber-700"
                : "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
            }`}
          >
            <div className="font-bold text-sm flex items-center gap-1">
              <span>{jumlahBelumScanKeluar}</span>
              {jumlahBelumScanKeluar > 0 && <span className="text-xs">⚠️</span>}
            </div>
            <div>belum scan keluar</div>
          </button>
          <button
            onClick={() => setFilterStatus(filterStatus === "belum_memilih" ? "semua" : "belum_memilih")}
            className={`rounded-lg px-3 py-2 text-left ${filterStatus === "belum_memilih" ? "bg-slate-600 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            <div className="font-bold text-sm">{jumlahBelumMemilih}</div>
            <div>belum memilih</div>
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
          <div>
            {(daftarKelas.length > 0 || pemilihList.some((p) => p.jenis === "guru")) && (
              <select className="border rounded-lg px-3 py-1.5 text-sm" value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)}>
                <option value="">Semua kelas</option>
                {daftarKelas.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
                {pemilihList.some((p) => p.jenis === "guru") && <option value="__guru__">Guru</option>}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={listTersaring.length === 0 || exportBusy !== null}
              title={`Ekspor ${listTersaring.length} data pemilih tersaring ke file Excel (.xlsx)`}
              className="inline-flex items-center gap-1.5 border border-emerald-600 bg-white hover:bg-emerald-50 text-emerald-700 font-medium text-xs px-3 py-1.5 rounded-lg shadow-sm transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {exportBusy === "excel" ? "Mengekspor..." : `Ekspor Excel (${listTersaring.length})`}
            </button>

            <button
              onClick={handleExportPdf}
              disabled={listTersaring.length === 0 || exportBusy !== null}
              title={`Ekspor ${listTersaring.length} data pemilih tersaring ke file PDF (.pdf)`}
              className="inline-flex items-center gap-1.5 border border-rose-600 bg-white hover:bg-rose-50 text-rose-700 font-medium text-xs px-3 py-1.5 rounded-lg shadow-sm transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              <svg className="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              {exportBusy === "pdf" ? "Mengekspor..." : `Ekspor PDF (${listTersaring.length})`}
            </button>
          </div>
        </div>

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
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{p.nama} <span className="text-slate-400 font-normal">-- {p.nis_nip}</span></p>
                      {p.status_pemilihan === "selesai" || p.sudah_memilih ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <span>✓ Selesai Memilih</span>
                          {p.alasan_keluar_manual && (
                            <span className="text-emerald-700 italic font-normal">({p.alasan_keluar_manual})</span>
                          )}
                        </span>
                      ) : p.status_pemilihan === "belum_scan_keluar" ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-900 flex items-center gap-1 border border-amber-300">
                          <span>⚠️ Belum Scan Keluar</span>
                          <span className="text-amber-700 font-normal">
                            ({p.menit_sejak_coblos ?? 0} mnt lalu)
                          </span>
                        </span>
                      ) : null}
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5">
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
                    <div className="flex items-center gap-2 shrink-0">
                      {p.status_pemilihan === "belum_scan_keluar" && (
                        p.bisa_ubah_manual ? (
                          <button
                            type="button"
                            onClick={() => bukaModalKeluarManual(p)}
                            className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium px-2.5 py-1 rounded-md shadow-sm transition"
                          >
                            Tandai Keluar Manual
                          </button>
                        ) : (
                          <span className="text-[11px] text-amber-800 italic bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                            Tunggu {Math.max(1, 5 - (p.menit_sejak_coblos ?? 0))} mnt lagi
                          </span>
                        )
                      )}
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

      {/* Modal Dialog Verifikasi Keluar Manual */}
      {modalKeluarTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div>
              <h3 className="font-bold text-base text-slate-900">Tandai Keluar Manual</h3>
              <p className="text-xs text-slate-500 mt-1">
                Verifikasi manual untuk pemilih yang sudah mencoblos di bilik suara namun berhalangan scan barcode di meja keluar.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
              <div><span className="text-slate-500">Nama:</span> <span className="font-semibold text-slate-800">{modalKeluarTarget.nama}</span></div>
              <div><span className="text-slate-500">{modalKeluarTarget.jenis === "siswa" ? "NIS / Kelas:" : "NIP / Pangkat:"}</span> <span className="font-semibold text-slate-800">{modalKeluarTarget.nis_nip} ({modalKeluarTarget.jenis === "siswa" ? modalKeluarTarget.kelas : modalKeluarTarget.pangkat})</span></div>
              <div><span className="text-slate-500">Waktu Coblos:</span> <span className="font-semibold text-amber-700">{modalKeluarTarget.menit_sejak_coblos ?? 0} menit yang lalu</span></div>
            </div>

            <form onSubmit={handleSimpanKeluarManual} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Alasan Keluar Manual <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="alasanKeluar"
                      value="Kendala teknis device / HP mati"
                      checked={alasanKeluar === "Kendala teknis device / HP mati"}
                      onChange={(e) => setAlasanKeluar(e.target.value)}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span>Kendala teknis device / HP mati</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="alasanKeluar"
                      value="Harus masuk kelas lagi"
                      checked={alasanKeluar === "Harus masuk kelas lagi"}
                      onChange={(e) => setAlasanKeluar(e.target.value)}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span>Harus masuk kelas lagi</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="alasanKeluar"
                      value="Lainnya"
                      checked={alasanKeluar === "Lainnya"}
                      onChange={(e) => setAlasanKeluar(e.target.value)}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span>Lainnya (sebutkan alasan)</span>
                  </label>
                </div>

                {alasanKeluar === "Lainnya" && (
                  <div className="pt-2">
                    <textarea
                      required
                      placeholder="Jelaskan alasan pemilih tidak scan keluar..."
                      rows={2}
                      value={detailAlasanLainnya}
                      onChange={(e) => setDetailAlasanLainnya(e.target.value)}
                      className="w-full text-xs border rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {errorKeluarManual && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2.5 rounded-lg">
                  {errorKeluarManual}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setModalKeluarTarget(null)}
                  disabled={busyKeluarManual}
                  className="px-3 py-1.5 border rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busyKeluarManual}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium shadow transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {busyKeluarManual ? "Memproses..." : "Konfirmasi Selesai"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
