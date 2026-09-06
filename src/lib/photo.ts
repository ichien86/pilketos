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

  const rawBuffer = Buffer.from(await file.arrayBuffer());

  // 1. Pre-process dengan Sharp:
  // - Auto-rotate tegak sesuai orientasi EXIF kamera HP
  // - Downscale ke batas max 800x800 agar AI penghapus background berjalan super cepat (<2 detik) dan hemat memori (<80MB RAM)
  let preprocessedBuffer: Buffer;
  try {
    preprocessedBuffer = await sharp(rawBuffer)
      .rotate()
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    throw new Error("File gambar rusak atau tidak dapat dibaca oleh sistem pengolah gambar.");
  }

  // 2. AI Penghapus Background
  let cutout: Buffer;
  try {
    const resultBlob = await removeBackground(new Uint8Array(preprocessedBuffer), { model: "small" });
    cutout = Buffer.from(await resultBlob.arrayBuffer());
  } catch {
    // Kalau AI model gagal atau timeout, gunakan foto hasil pre-process apa adanya daripada gagal total
    cutout = preprocessedBuffer;
  }

  // 3. Potong dan rapikan kanvas avatar 480x480
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
        fit: "cover",
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

