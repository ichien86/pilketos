"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-fetch";
import { JENIS_BUKTI_IDENTITAS, type JenisBuktiIdentitas } from "@/types";
import { labelNomorBukti } from "@/lib/bukti-identitas";

interface BuktiIdentitas {
  bukti_jenis: JenisBuktiIdentitas | null;
  bukti_jenis_lainnya: string | null;
  bukti_nomor: string | null;
}

// Pesan pengingat bukti diri hari-H + menu ubah, ditampilkan di dashboard
// pemilih sebelum check-in (lihat pemilih/page.tsx). Data ini pertama diisi
// wajib saat aktivasi (akun/aktivasi); di sini pemilih boleh mengubahnya lagi
// kapan saja lewat api/akun/bukti-identitas -- termasuk saat hari-H kalau
// mis. ternyata dokumen yang dibawa berbeda dari yang dijanjikan dulu.
export default function BuktiIdentitasEditor() {
  const [data, setData] = useState<BuktiIdentitas | null>(null);
  const [editing, setEditing] = useState(false);
  const [jenis, setJenis] = useState<JenisBuktiIdentitas | "">("");
  const [jenisLainnya, setJenisLainnya] = useState("");
  const [nomor, setNomor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await apiFetch<BuktiIdentitas>("/api/akun/bukti-identitas");
    setData(res);
    setJenis(res.bukti_jenis ?? "");
    setJenisLainnya(res.bukti_jenis_lainnya ?? "");
    setNomor(res.bukti_nomor ?? "");
    if (!res.bukti_jenis) setEditing(true);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/akun/bukti-identitas", {
        method: "PUT",
        body: JSON.stringify({ bukti_jenis: jenis, bukti_jenis_lainnya: jenisLainnya, bukti_nomor: nomor }),
      });
      await load();
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;

  const labelJenis = data.bukti_jenis === "Lainnya" ? data.bukti_jenis_lainnya : data.bukti_jenis;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left space-y-2">
      {data.bukti_jenis ? (
        <p className="text-sm text-amber-800">
          Segera datang ke TPS dengan membawa bukti <strong>{labelJenis}</strong> dengan nomor <strong>{data.bukti_nomor}</strong>.
        </p>
      ) : (
        <p className="text-sm text-amber-800">Lengkapi dulu bukti diri yang akan Anda bawa ke TPS.</p>
      )}

      {!editing && (
        <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline">
          Ubah bukti diri
        </button>
      )}

      {editing && (
        <form onSubmit={submit} className="space-y-2 pt-1">
          <select
            className="w-full border rounded-lg px-2 py-1.5 text-sm"
            value={jenis}
            onChange={(e) => setJenis(e.target.value as JenisBuktiIdentitas)}
            required
          >
            <option value="" disabled>Pilih jenis dokumen</option>
            {JENIS_BUKTI_IDENTITAS.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
          {jenis === "Lainnya" && (
            <input
              className="w-full border rounded-lg px-2 py-1.5 text-sm"
              placeholder="Nama dokumen"
              value={jenisLainnya}
              onChange={(e) => setJenisLainnya(e.target.value)}
              required
            />
          )}
          <input
            className="w-full border rounded-lg px-2 py-1.5 text-sm"
            placeholder={`Masukkan ${labelNomorBukti(jenis, jenisLainnya)} Anda`}
            value={nomor}
            onChange={(e) => setNomor(e.target.value)}
            required
          />
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <div className="flex gap-2">
            {data.bukti_jenis && (
              <button type="button" onClick={() => setEditing(false)} className="flex-1 border rounded-lg py-1.5 text-sm">
                Batal
              </button>
            )}
            <button type="submit" disabled={busy} className="flex-1 bg-slate-900 text-white rounded-lg py-1.5 text-sm disabled:opacity-50">
              {busy ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
