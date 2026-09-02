import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as tontonVideo } from "@/app/api/video/[id]/tonton/route";
import { GET as getProgress } from "@/app/api/progress/route";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { signSession } from "@/lib/auth";
import { seedPemilih, seedKandidatAktif } from "./helpers";
import type { KontrolFase, ProgressPemilih, VideoKampanye } from "@/types";

function pemilihCookie(pemilihId: string): string {
  const token = signSession({ akunId: newId(), pemilihId, kandidatId: null, role: "pemilih", username: "pemilih1" });
  return `pilketos_session=${token}`;
}

describe("menonton video sosialisasi (termasuk pada hari-H pemilihan)", () => {
  it("pemilih dapat menonton video dan progress tercatat saat masa sosialisasi aktif", async () => {
    const db = await getDb("prod");
    const k1 = await seedKandidatAktif(1);
    const pemilih = await seedPemilih();
    const cookie = pemilihCookie(pemilih._id);

    await db.collection<KontrolFase>("kontrol_fase").deleteMany({});
    await db.collection<KontrolFase>("kontrol_fase").insertOne({
      _id: newId(),
      nama_fase: "sosialisasi",
      status: "aktif",
      dibuka_at: new Date(),
      ditutup_at: null,
      kandidat_terkunci: [k1._id],
      hasil_diumumkan: false,
      hasil_diumumkan_at: null,
    });

    const v1Id = newId();
    await db.collection<VideoKampanye>("video_kampanye").insertOne({
      _id: v1Id,
      kandidat_id: k1._id,
      url: "/uploads/video1.mp4",
      status: "aktif",
      created_at: new Date(),
      published_at: new Date(),
    });

    const res = await tontonVideo(
      new NextRequest(`http://localhost/api/video/${v1Id}/tonton`, {
        method: "POST",
        headers: { cookie },
      }),
      { params: { id: v1Id } }
    );
    expect(res.status).toBe(200);

    const progress = await db.collection<ProgressPemilih>("progress_pemilih").findOne({ pemilih_id: pemilih._id });
    expect(progress?.video_ditonton).toContain(k1._id);
  });

  it("pemilih yang belum menonton video TETAP BISA menonton dan mencatat progress saat hari-H pemilihan (fase pemilihan aktif)", async () => {
    const db = await getDb("prod");
    const k1 = await seedKandidatAktif(1);
    const k2 = await seedKandidatAktif(2);
    const pemilih = await seedPemilih();
    const cookie = pemilihCookie(pemilih._id);

    await db.collection<KontrolFase>("kontrol_fase").deleteMany({});
    await db.collection<KontrolFase>("kontrol_fase").insertMany([
      {
        _id: newId(),
        nama_fase: "sosialisasi",
        status: "ditutup",
        dibuka_at: new Date(),
        ditutup_at: new Date(),
        kandidat_terkunci: [k1._id, k2._id],
        hasil_diumumkan: false,
        hasil_diumumkan_at: null,
      },
      {
        _id: newId(),
        nama_fase: "pemilihan",
        status: "aktif",
        dibuka_at: new Date(),
        ditutup_at: null,
        kandidat_terkunci: null,
        hasil_diumumkan: false,
        hasil_diumumkan_at: null,
      },
    ]);

    const v1Id = newId();
    const v2Id = newId();
    await db.collection<VideoKampanye>("video_kampanye").insertMany([
      {
        _id: v1Id,
        kandidat_id: k1._id,
        url: "/uploads/video1.mp4",
        status: "aktif",
        created_at: new Date(),
        published_at: new Date(),
      },
      {
        _id: v2Id,
        kandidat_id: k2._id,
        url: "/uploads/video2.mp4",
        status: "aktif",
        created_at: new Date(),
        published_at: new Date(),
      },
    ]);

    // Tonton video paslon 1 di hari-H
    const res1 = await tontonVideo(
      new NextRequest(`http://localhost/api/video/${v1Id}/tonton`, {
        method: "POST",
        headers: { cookie },
      }),
      { params: { id: v1Id } }
    );
    expect(res1.status).toBe(200);

    // Tonton video paslon 2 di hari-H
    const res2 = await tontonVideo(
      new NextRequest(`http://localhost/api/video/${v2Id}/tonton`, {
        method: "POST",
        headers: { cookie },
      }),
      { params: { id: v2Id } }
    );
    expect(res2.status).toBe(200);

    // Cek endpoint progress
    const progRes = await getProgress(
      new NextRequest("http://localhost/api/progress", {
        headers: { cookie },
      })
    );
    expect(progRes.status).toBe(200);
    const progData = await progRes.json();
    expect(progData.total).toBe(2);
    expect(progData.sudah_ditonton).toBe(2);
  });
});
