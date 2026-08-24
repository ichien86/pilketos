import { describe, it, expect } from "vitest";
import { getDb } from "@/lib/db";
import { isSesiExpired, expireSesiIfNeeded } from "@/lib/ttl";
import { TTL_MENUNGGU_MS, TTL_DI_BILIK_MS, type Bilik, type SesiPemilih } from "@/types";
import { seedFaseAktifPemilihan, seedBilikKosong, seedPemilih, seedSesiMenunggu } from "./helpers";

describe("TTL dua lapis (Bagian 5)", () => {
  it("sesi menunggu kedaluwarsa setelah lewat 60 menit, TIDAK sebelum itu", async () => {
    await seedFaseAktifPemilihan();
    const pemilih = await seedPemilih();
    const sesi = await seedSesiMenunggu(pemilih._id, "hash");

    expect(isSesiExpired({ ...sesi, antre_at: new Date(Date.now() - TTL_MENUNGGU_MS + 5000) })).toBe(false);
    expect(isSesiExpired({ ...sesi, antre_at: new Date(Date.now() - TTL_MENUNGGU_MS - 5000) })).toBe(true);
  });

  it("sesi di_bilik kedaluwarsa setelah 5 menit DAN melepas bilik otomatis", async () => {
    await seedFaseAktifPemilihan();
    const db = await getDb("prod");
    const bilik = await seedBilikKosong(9);
    const pemilih = await seedPemilih();
    const sesi = await seedSesiMenunggu(pemilih._id, "hash2");

    const diBilik: SesiPemilih = {
      ...sesi,
      status: "di_bilik",
      bilik_id: bilik._id,
      masuk_bilik_at: new Date(Date.now() - TTL_DI_BILIK_MS - 1000),
    };
    await db.collection<SesiPemilih>("sesi_pemilih").updateOne({ _id: sesi._id }, { $set: diBilik });
    await db.collection<Bilik>("bilik").updateOne({ _id: bilik._id }, { $set: { status: "terisi", sesi_aktif_id: sesi._id } });

    const updated = await expireSesiIfNeeded(db, diBilik);
    expect(updated.status).toBe("kedaluwarsa");

    const bilikSetelah = await db.collection<Bilik>("bilik").findOne({ _id: bilik._id });
    expect(bilikSetelah?.status).toBe("kosong");
    expect(bilikSetelah?.sesi_aktif_id).toBeNull();
  });
});
