import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as resetPassword } from "@/app/api/akun/reset-password/route";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { hashPassword, signSession, verifyPassword } from "@/lib/auth";
import { seedPemilih } from "./helpers";
import type { AkunPengguna, ResetLog } from "@/types";

async function seedAkunAktif(pemilihId: string, username: string) {
  const db = await getDb("prod");
  const akun: AkunPengguna = {
    _id: newId(),
    pemilih_id: pemilihId,
    kandidat_id: null,
    username,
    password_hash: await hashPassword("passwordLamaBebas123"),
    role: "pemilih",
    aktivasi_selesai: true,
    wajib_ganti_password: false,
    created_at: new Date(),
  };
  await db.collection<AkunPengguna>("akun_pengguna").insertOne(akun);
  return akun;
}

function panitiaCookie(): string {
  const token = signSession({ akunId: newId(), pemilihId: null, kandidatId: null, role: "panitia", username: "panitia1" });
  return `pilketos_session=${token}`;
}
function pemilihCookie(): string {
  const token = signSession({ akunId: newId(), pemilihId: newId(), kandidatId: null, role: "pemilih", username: "p1" });
  return `pilketos_session=${token}`;
}
function resetReq(username: string, cookie = panitiaCookie()) {
  return new NextRequest("http://localhost/api/akun/reset-password", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ username }),
  });
}

// US-04 -- reset password SELALU mengembalikan ke password default sistem
// (DEFAULT_PASSWORD, "MAN3Byl" di env test), bukan password acak, supaya
// panitia tidak perlu mencatat/membagikan password unik per reset.
describe("reset password pemilih (US-04)", () => {
  it("mengembalikan password ke default sistem, bukan acak, dan mewajibkan aktivasi ulang", async () => {
    const pemilih = await seedPemilih({ nis_nip: "R001" });
    await seedAkunAktif(pemilih._id, "R001");

    const res = await resetPassword(resetReq("R001"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.password_sementara).toBe(process.env.DEFAULT_PASSWORD ?? "MAN3Byl");

    const db = await getDb("prod");
    const akun = await db.collection<AkunPengguna>("akun_pengguna").findOne({ username: "R001" });
    expect(akun?.aktivasi_selesai).toBe(false);
    expect(akun?.wajib_ganti_password).toBe(true);
    expect(await verifyPassword(process.env.DEFAULT_PASSWORD ?? "MAN3Byl", akun!.password_hash)).toBe(true);

    const log = await db.collection<ResetLog>("reset_log").findOne({ pemilih_id: pemilih._id });
    expect(log?.direset_oleh).toBeTruthy();
  });

  it("404 untuk username yang tidak terdaftar", async () => {
    const res = await resetPassword(resetReq("TIDAK_ADA"));
    expect(res.status).toBe(404);
  });

  it("ditolak untuk role selain admin/panitia", async () => {
    const res = await resetPassword(resetReq("R002", pemilihCookie()));
    expect(res.status).toBe(403);
  });
});
