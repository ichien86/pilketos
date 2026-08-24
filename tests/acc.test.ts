import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as accCheckin } from "@/app/api/panitia/checkin/acc/route";
import { signSession } from "@/lib/auth";
import { newId } from "@/lib/id";
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

  it("menolak ACC untuk pemilih yang belum memenuhi syarat", async () => {
    await seedFaseAktifPemilihan();
    const kandidat = await seedKandidatAktif(1);
    // pemilih TIDAK di-seed lolos syarat (tidak ada akun aktivasi/progress)
    const res = await accCheckin(accReq(newId()));
    expect(res.status).toBe(403);
    void kandidat;
  });
});
