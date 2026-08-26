import { JENIS_BUKTI_IDENTITAS, type JenisBuktiIdentitas } from "@/types";

export interface BuktiIdentitasInput {
  bukti_jenis: JenisBuktiIdentitas;
  bukti_jenis_lainnya: string | null;
  bukti_nomor: string;
}

// Validasi bersama dipakai saat aktivasi (wajib diisi pertama kali) dan saat
// pemilih mengubahnya sendiri sebelum check-in hari-H (lihat
// api/akun/bukti-identitas). Mengembalikan pesan error atau null kalau valid.
export function validasiBuktiIdentitas(body: unknown): { data: BuktiIdentitasInput } | { error: string } {
  const b = body as Record<string, unknown> | null;
  const jenis = typeof b?.bukti_jenis === "string" ? b.bukti_jenis : "";
  const jenisLainnya = typeof b?.bukti_jenis_lainnya === "string" ? b.bukti_jenis_lainnya.trim() : "";
  const nomor = typeof b?.bukti_nomor === "string" ? b.bukti_nomor.trim() : "";

  if (!JENIS_BUKTI_IDENTITAS.includes(jenis as JenisBuktiIdentitas)) {
    return { error: `bukti_jenis wajib salah satu dari: ${JENIS_BUKTI_IDENTITAS.join(", ")}` };
  }
  if (jenis === "Lainnya" && !jenisLainnya) {
    return { error: "bukti_jenis_lainnya wajib diisi kalau bukti_jenis 'Lainnya'" };
  }
  if (!nomor) {
    return { error: "bukti_nomor wajib diisi" };
  }

  return {
    data: {
      bukti_jenis: jenis as JenisBuktiIdentitas,
      bukti_jenis_lainnya: jenis === "Lainnya" ? jenisLainnya : null,
      bukti_nomor: nomor,
    },
  };
}
