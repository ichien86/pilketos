import type { Db } from "mongodb";
import { newId } from "@/lib/id";
import type { ChecklistItem } from "@/types";

// US-21 -- item checklist Go/No-Go, hasil pengujian di fase simulasi (Epic 6).
export const CHECKLIST_DEFAULT: Array<{ kode: string; label: string }> = [
  { kode: "beban_registrasi", label: "Beban registrasi (checkin+ACC) teruji di fase simulasi" },
  { kode: "integritas_transaksi_vote", label: "Integritas transaksi vote (klaim bilik + submit atomik) teruji" },
  { kode: "barcode_sekali_pakai", label: "Barcode identitas & barcode bukti teruji sekali pakai / kedaluwarsa" },
  { kode: "rekonsiliasi_konsisten", label: "Rekonsiliasi (total token = total suara) konsisten di simulasi" },
  { kode: "koneksi_cadangan", label: "Koneksi cadangan teruji saat koneksi utama diputus di tengah simulasi" },
  { kode: "isolasi_data", label: "Isolasi data simulasi dari data produksi terverifikasi" },
];

export async function ensureChecklistSeeded(db: Db): Promise<void> {
  const existing = await db.collection<ChecklistItem>("checklist_gonogo").find({}).toArray();
  const existingKode = new Set(existing.map((c) => c.kode));
  const now = new Date();
  const toInsert: ChecklistItem[] = CHECKLIST_DEFAULT.filter((c) => !existingKode.has(c.kode)).map((c) => ({
    _id: newId(),
    kode: c.kode,
    label: c.label,
    lolos: false,
    catatan: null,
    updated_at: now,
  }));
  if (toInsert.length > 0) {
    await db.collection<ChecklistItem>("checklist_gonogo").insertMany(toInsert);
  }
}
