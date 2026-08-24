import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { newId } from "@/lib/id";

const ALLOWED_VIDEO_EXT = new Set([".mp4", ".webm", ".mov", ".m4v"]);
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB, cukup untuk video kampanye singkat

export async function saveUploadedVideo(file: File): Promise<string> {
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_VIDEO_EXT.has(ext)) {
    throw new Error("Format video tidak didukung (pakai mp4/webm/mov/m4v)");
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error("Ukuran video melebihi batas 200MB");
  }

  const uploadDir = process.env.UPLOAD_DIR ?? "./public/uploads";
  const videoDir = path.join(process.cwd(), uploadDir.replace(/^\.\//, ""), "video");
  await mkdir(videoDir, { recursive: true });

  const filename = `${newId()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(videoDir, filename), buffer);

  return `/uploads/video/${filename}`;
}
