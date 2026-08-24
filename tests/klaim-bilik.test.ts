import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as klaimBilik } from "@/app/api/vote/klaim-bilik/route";
import { generateVoteToken, hashToken } from "@/lib/voteToken";
import {
  seedFaseAktifPemilihan,
  seedPemilih,
  seedBilikKosong,
  seedSesiMenunggu,
  loginCookieHeader,
} from "./helpers";

function postReq(body: unknown, cookie?: string) {
  return new NextRequest("http://localhost/api/vote/klaim-bilik", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("klaim bilik (Bagian 4.3)", () => {
  it("race condition: dua pemilih klaim bilik sama nyaris bersamaan -- hanya satu berhasil", async () => {
    await seedFaseAktifPemilihan();
    const bilik = await seedBilikKosong(1);

    const pemilihA = await seedPemilih();
    const tokenA = generateVoteToken();
    await seedSesiMenunggu(pemilihA._id, hashToken(tokenA));

    const pemilihB = await seedPemilih();
    const tokenB = generateVoteToken();
    await seedSesiMenunggu(pemilihB._id, hashToken(tokenB));

    const [resA, resB] = await Promise.all([
      klaimBilik(postReq({ voteToken: tokenA, qrBilikHash: bilik.qr_hash })),
      klaimBilik(postReq({ voteToken: tokenB, qrBilikHash: bilik.qr_hash })),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  it("menolak request yang membawa sesi login pemilih, bukan voteToken", async () => {
    await seedFaseAktifPemilihan();
    const bilik = await seedBilikKosong(2);
    const pemilih = await seedPemilih();

    const res = await klaimBilik(
      postReq(
        { voteToken: "abc", qrBilikHash: bilik.qr_hash },
        loginCookieHeader(pemilih._id)
      )
    );
    expect(res.status).toBe(401);
  });

  it("menolak voteToken yang tidak valid", async () => {
    await seedFaseAktifPemilihan();
    const bilik = await seedBilikKosong(3);
    const res = await klaimBilik(postReq({ voteToken: "tidak-ada", qrBilikHash: bilik.qr_hash }));
    expect(res.status).toBe(409);
  });
});
