import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as accCheckin } from "@/app/api/panitia/checkin/acc/route";
import { signSession } from "@/lib/auth";
import { newId } from "@/lib/id";
import { getDb } from "@/lib/db";
import { ensureIndexes } from "@/lib/indexes";
import { seedFaseAktifPemilihan, seedKandidatAktif, seedPemilihLolosSyarat } from "./helpers";

function panitiaCookie(): string {
  const token = signSession({
    akunId: newId(),
    pemilihId: null,
    kandidatId: null,
    role: "panitia",
    username: "panitia1",
  });
  return `pilketos_session=${token}`;
}

function accReq(pemilihId: string) {
  return new NextRequest("http://localhost/api/panitia/checkin/acc", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: panitiaCookie() },
    body: JSON.stringify({ pemilihId }),
  });
}

describe("ACC check-in (Bagian 3 langkah 2)", () => {
  it("mencegah ACC dua kali untuk pemilih yang sama di hari yang sama", async () => {
    await seedFaseAktifPemilihan();
    const kandidat = await seedKandidatAktif(1);
    const pemilih = await seedPemilihLolosSyarat([kandidat._id]);

    const res1 = await accCheckin(accReq(pemilih._id));
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(typeof body1.voteToken).toBe("string");

    const res2 = await accCheckin(accReq(pemilih._id));
    expect(res2.status).toBe(409);
  });

  it("race condition: dua ACC nyaris bersamaan untuk pemilih yang sama -- hanya satu berhasil", async () => {
    await seedFaseAktifPemilihan();
    // findOne-lalu-insert di endpoint tidak cukup untuk ini -- unique index
    // partial (lib/indexes.ts) yang jadi penjamin atomiknya, jadi test ini
    // HARUS memastikan index itu ada dulu, persis seperti production yang
    // menjalankan `npm run setup-db` sebelum hari-H.
    await ensureIndexes(await getDb("prod"));
    const kandidat = await seedKandidatAktif(1);
    const pemilih = await seedPemilihLolosSyarat([kandidat._id]);

    const [res1, res2] = await Promise.all([accCheckin(accReq(pemilih._id)), accCheckin(accReq(pemilih._id))]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  it("menolak ACC untuk pemilih yang belum memenuhi syarat", async () => {
    await seedFaseAktifPemilihan();
    const kandidat = await seedKandidatAktif(1);
    // pemilih TIDAK di-seed lolos syarat (tidak ada akun aktivasi/progress)
    const res = await accCheckin(accReq(newId()));
    expect(res.status).toBe(403);
    void kandidat;
  });
});
