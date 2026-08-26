import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as klaimBilik } from "@/app/api/vote/klaim-bilik/route";
import { POST as submitVote } from "@/app/api/vote/[token]/submit/route";
import { POST as exitScan } from "@/app/api/panitia/exit-scan/route";
import { GET as rekonsiliasi } from "@/app/api/admin/rekonsiliasi/route";
import { GET as daftarToken } from "@/app/api/admin/rekonsiliasi/daftar-token/route";
import { generateVoteToken, hashToken } from "@/lib/voteToken";
import { getDb } from "@/lib/db";
import { signSession } from "@/lib/auth";
import { newId } from "@/lib/id";
import {
  seedFaseAktifPemilihan,
  seedKandidatAktif,
  seedBilikKosong,
  seedPemilih,
  seedSesiMenunggu,
} from "./helpers";
import type { Bilik, Suara } from "@/types";

function panitiaCookie(): string {
  const token = signSession({ akunId: newId(), pemilihId: null, kandidatId: null, role: "panitia", username: "p" });
  return `pilketos_session=${token}`;
}

describe("submit vote atomik + rekonsiliasi (US-14, US-16, US-17)", () => {
  it("suara tersimpan anonim, bilik lepas, exit-scan sekali pakai, total rekonsiliasi cocok", async () => {
    await seedFaseAktifPemilihan();
    const kandidat = await seedKandidatAktif(1);
    const bilik = await seedBilikKosong(1);
    const pemilih = await seedPemilih();
    const voteToken = generateVoteToken();
    await seedSesiMenunggu(pemilih._id, hashToken(voteToken));

    const klaimRes = await klaimBilik(
      new NextRequest("http://localhost/api/vote/klaim-bilik", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ voteToken, qrBilikHash: bilik.qr_hash }),
      })
    );
    expect(klaimRes.status).toBe(200);

    const submitRes = await submitVote(
      new NextRequest(`http://localhost/api/vote/${voteToken}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kandidatId: kandidat._id }),
      }),
      { params: { token: voteToken } }
    );
    expect(submitRes.status).toBe(200);
    const submitBody = await submitRes.json();
    const buktiToken = submitBody.buktiToken as string;
    expect(typeof buktiToken).toBe("string");

    const db = await getDb("prod");
    const suara = await db.collection<Suara>("suara").find({}).toArray();
    expect(suara).toHaveLength(1);
    expect(suara[0]).not.toHaveProperty("pemilih_id");

    const bilikSetelah = await db.collection<Bilik>("bilik").findOne({ _id: bilik._id });
    expect(bilikSetelah?.status).toBe("kosong");

    const scan1 = await exitScan(
      new NextRequest("http://localhost/api/panitia/exit-scan", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: panitiaCookie() },
        body: JSON.stringify({ buktiToken }),
      })
    );
    expect(scan1.status).toBe(200);

    const scan2 = await exitScan(
      new NextRequest("http://localhost/api/panitia/exit-scan", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: panitiaCookie() },
        body: JSON.stringify({ buktiToken }),
      })
    );
    expect(scan2.status).toBe(409);

    const rekonRes = await rekonsiliasi(
      new NextRequest("http://localhost/api/admin/rekonsiliasi?mode=prod", {
        headers: { cookie: panitiaCookie() },
      })
    );
    const rekon = await rekonRes.json();
    expect(rekon.total_token_terbit).toBe(1);
    expect(rekon.total_sudah_memilih).toBe(1);
    expect(rekon.total_suara).toBe(1);
    expect(rekon.total_scan_keluar).toBe(1);
    expect(rekon.perlu_investigasi).toBe(false);

    const daftarRes = await daftarToken(
      new NextRequest("http://localhost/api/admin/rekonsiliasi/daftar-token?mode=prod", {
        headers: { cookie: panitiaCookie() },
      })
    );
    const daftarBody = await daftarRes.json();
    expect(daftarBody.daftar).toHaveLength(1);
    const baris = daftarBody.daftar[0];
    expect(baris.nama).toBe(pemilih.nama);
    expect(baris.nis_nip).toBe(pemilih.nis_nip);
    expect(baris.status).toBe("selesai");
    expect(baris.sudah_scan_keluar).toBe(true);
    // Tidak pernah menyertakan kredensial token atau pilihan suaranya.
    expect(baris).not.toHaveProperty("token_hash");
    expect(baris).not.toHaveProperty("kandidat_dipilih_nomor");
    expect(baris).not.toHaveProperty("barcode_bukti_plain");
  });
});
