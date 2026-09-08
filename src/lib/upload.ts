import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { newId } from "@/lib/id";
import { resolveUploadBaseDir } from "@/lib/upload-path";

const ALLOWED_VIDEO_EXT = new Set([".mp4", ".webm", ".mov", ".m4v"]);
const MAX_VIDEO_MB = parseInt(process.env.MAX_VIDEO_MB || "50", 10);
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024; // Default 50MB, ideal untuk video kampanye 1-3 menit

export async function saveUploadedVideo(file: File): Promise<string> {
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_VIDEO_EXT.has(ext)) {
    throw new Error("Format video tidak didukung. Harap gunakan format MP4, WEBM, MOV, atau M4V.");
  }
  if (file.size > MAX_VIDEO_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `Ukuran file video (${sizeMb} MB) melebihi batas maksimal ${MAX_VIDEO_MB} MB. Silakan pilih file yang lebih kecil atau kompres terlebih dahulu.`
    );
  }

  const videoDir = path.join(resolveUploadBaseDir(), "video");
  await mkdir(videoDir, { recursive: true });

  const filename = `${newId()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(videoDir, filename), buffer);

  return `/api/uploads/video/${filename}`;
}
