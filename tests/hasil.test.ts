import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as getHasil } from "@/app/api/hasil/route";
import { POST as umumkanHasil } from "@/app/api/fase/pemilihan/umumkan-hasil/route";
import { getDb } from "@/lib/db";
import { signSession } from "@/lib/auth";
import { newId } from "@/lib/id";
import type { KontrolFase, Suara } from "@/types";
import { seedKandidatAktif, loginCookieHeader } from "./helpers";

function adminCookie(): string {
  const token = signSession({ akunId: newId(), pemilihId: null, kandidatId: null, role: "admin", username: "admin1" });
  return `pilketos_session=${token}`;
}
function panitiaCookie(): string {
  const token = signSession({ akunId: newId(), pemilihId: null, kandidatId: null, role: "panitia", username: "panitia1" });
  return `pilketos_session=${token}`;
}

async function setFasePemilihan(status: "belum_dibuka" | "aktif" | "ditutup") {
  const db = await getDb("prod");
  await db.collection<KontrolFase>("kontrol_fase").deleteMany({ nama_fase: "pemilihan" });
  await db.collection<KontrolFase>("kontrol_fase").insertOne({
    _id: newId(),
    nama_fase: "pemilihan",
    status,
    dibuka_at: new Date(),
    ditutup_at: status === "ditutup" ? new Date() : null,
    kandidat_terkunci: null,
    hasil_diumumkan: false,
    hasil_diumumkan_at: null,
  });
}

function hasilReq() {
  return new NextRequest("http://localhost/api/hasil", {
    headers: { cookie: loginCookieHeader(newId()) },
  });
}
function umumkanReq(cookie: string, umumkan = true) {
  return new NextRequest("http://localhost/api/fase/pemilihan/umumkan-hasil", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ umumkan }),
  });
}

describe("hasil pemilihan (pengumuman ke pemilih)", () => {
  it("tidak menampilkan hasil sebelum diumumkan, walau suara sudah ada", async () => {
    await setFasePemilihan("ditutup");
    const kandidat = await seedKandidatAktif(1);
    const db = await getDb("prod");
    await db.collection<Suara>("suara").insertOne({ _id: newId(), kandidat_id: kandidat._id, created_at: new Date() });

    const res = await getHasil(hasilReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.diumumkan).toBe(false);
    expect(body.per_paslon).toBeUndefined();
  });

  it("menolak pengumuman selain admin", async () => {
    await setFasePemilihan("ditutup");
    const res = await umumkanHasil(umumkanReq(panitiaCookie()));
    expect(res.status).toBe(403);
  });

  it("menolak pengumuman selama fase pemilihan belum ditutup", async () => {
    await setFasePemilihan("aktif");
    const res = await umumkanHasil(umumkanReq(adminCookie()));
    expect(res.status).toBe(409);
  });

  it("admin umumkan setelah ditutup -> pemilih langsung bisa lihat tally", async () => {
    await setFasePemilihan("ditutup");
    const kandidat = await seedKandidatAktif(1);
    const db = await getDb("prod");
    await db.collection<Suara>("suara").insertMany([
      { _id: newId(), kandidat_id: kandidat._id, created_at: new Date() },
      { _id: newId(), kandidat_id: kandidat._id, created_at: new Date() },
    ]);

    const umumkanRes = await umumkanHasil(umumkanReq(adminCookie()));
    expect(umumkanRes.status).toBe(200);

    const res = await getHasil(hasilReq());
    const body = await res.json();
    expect(body.diumumkan).toBe(true);
    expect(body.total_suara).toBe(2);
    expect(body.per_paslon.find((p: { kandidat_id: string }) => p.kandidat_id === kandidat._id).jumlah_suara).toBe(2);
  });
});
