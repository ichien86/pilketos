import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { removeBackground } from "@imgly/background-removal-node";
import { newId } from "@/lib/id";
import { resolveUploadBaseDir } from "@/lib/upload-path";

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB, cukup longgar untuk foto kamera HP
const AVATAR_SIZE = 480;

/**
 * Foto ketua/wakil paslon: background dihilangkan otomatis (kalau ada),
 * lalu dipotong jadi kanvas persegi transparan supaya rapi dipakai sebagai
 * avatar bulat kecil di UI (lihat CandidateAvatar) -- avatar SENGAJA kecil
 * & sekunder di semua layar pemilih, visi/misi tetap yang paling menonjol.
 */
export async function processAndSavePhoto(file: File): Promise<string> {
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error(`Format file '${ext || "tidak dikenal"}' tidak didukung. Harap gunakan file gambar JPG, JPEG, PNG, atau WEBP.`);
  }
  if (file.size > MAX_PHOTO_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`Ukuran foto terlalu besar (${sizeMb} MB). Batas maksimal ukuran foto adalah 8 MB.`);
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const inputBlob = new Blob([new Uint8Array(inputBuffer)], { type: file.type || "image/jpeg" });

  let cutout: Buffer;
  try {
    const resultBlob = await removeBackground(inputBlob, { model: "small" });
    cutout = Buffer.from(await resultBlob.arrayBuffer());
  } catch {
    // Kalau model gagal (mis. format tidak dikenali di sisi model), pakai
    // foto asli apa adanya daripada gagal total -- lebih baik ada foto
    // dengan background daripada tidak ada foto sama sekali.
    cutout = inputBuffer;
  }

  let avatarBuffer: Buffer;
  try {
    avatarBuffer = await sharp(cutout)
      .trim({ threshold: 10 })
      .resize(AVATAR_SIZE, AVATAR_SIZE, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
  } catch {
    // Fallback jika .trim() gagal (misal gambar transparan penuh atau warna latar belakang seragam)
    avatarBuffer = await sharp(cutout)
      .resize(AVATAR_SIZE, AVATAR_SIZE, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
  }

  const fotoDir = path.join(resolveUploadBaseDir(), "foto");
  await mkdir(fotoDir, { recursive: true });

  const filename = `${newId()}.png`;
  await writeFile(path.join(fotoDir, filename), avatarBuffer);

  return `/api/uploads/foto/${filename}`;
}

