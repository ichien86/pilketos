import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { getDb } from "@/lib/db";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { resolveAppMode } from "@/lib/fase-gate";
import { uploadUrlToPath } from "@/lib/upload-path";
import type { VideoKampanye } from "@/types";

export const dynamic = "force-dynamic";

// Hapus video kampanye berstatus draft (oleh paslon pemilik atau panitia/admin).
// File fisik di server juga langsung dibersihkan dari disk.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["kandidat", "panitia", "admin"])) {
    return errorJson("Tidak diizinkan", 403);
  }

  const db = await getDb(await resolveAppMode());
  const video = await db.collection<VideoKampanye>("video_kampanye").findOne({ _id: params.id });
  if (!video) return errorJson("Video tidak ditemukan", 404);

  if (claims.role === "kandidat" && video.kandidat_id !== claims.kandidatId) {
    return errorJson("Tidak diizinkan menghapus video kandidat lain", 403);
  }

  if (video.status === "aktif") {
    return errorJson(
      "Video yang sedang aktif tidak dapat langsung dihapus. Silakan batalkan publish (kembalikan ke draft) terlebih dahulu.",
      400
    );
  }

  // Hapus file fisik video dari disk jika path valid
  if (video.url) {
    const filePath = uploadUrlToPath(video.url);
    if (filePath) {
      await unlink(filePath).catch(() => {
        // Abaikan jika file fisik sudah tidak ada
      });
    }
  }

  await db.collection<VideoKampanye>("video_kampanye").deleteOne({ _id: params.id });
  return NextResponse.json({ ok: true, message: "Video draft berhasil dihapus" });
}
