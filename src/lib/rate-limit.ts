import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// In-memory sliding window rate limiter
// ---------------------------------------------------------------------------

interface HitRecord {
  timestamps: number[];
}

const store = new Map<string, HitRecord>();

// Garbage collection: hapus key yang tidak aktif setiap 5 menit
const GC_INTERVAL_MS = 5 * 60 * 1000;
let lastGc = Date.now();

function gc(now: number) {
  if (now - lastGc < GC_INTERVAL_MS) return;
  lastGc = now;
  store.forEach((record, key) => {
    // Hapus key yang tidak punya hit dalam 2 menit terakhir
    if (record.timestamps.length === 0) {
      store.delete(key);
      return;
    }
    const newest = record.timestamps[record.timestamps.length - 1];
    if (now - newest > 2 * 60 * 1000) {
      store.delete(key);
    }
  });
}

/**
 * Cek rate limit menggunakan sliding window.
 *
 * @param key   - Identifier unik (mis. `login:ip:1.2.3.4` atau `login:user:adi`)
 * @param limit - Jumlah hit maksimal yang diizinkan dalam window
 * @param windowSeconds - Durasi window dalam detik
 * @returns `{ limited: false, remaining }` jika masih di bawah batas,
 *          `{ limited: true, retryAfter }` jika sudah melampaui batas.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): { limited: false; remaining: number } | { limited: true; retryAfter: number } {
  const now = Date.now();
  gc(now);

  const windowMs = windowSeconds * 1000;
  let record = store.get(key);
  if (!record) {
    record = { timestamps: [] };
    store.set(key, record);
  }

  // Buang hit yang sudah di luar window
  const cutoff = now - windowMs;
  record.timestamps = record.timestamps.filter((t) => t > cutoff);

  if (record.timestamps.length >= limit) {
    // Hitung waktu tunggu sampai hit tertua keluar dari window
    const oldestInWindow = record.timestamps[0];
    const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000);
    return { limited: true, retryAfter: Math.max(retryAfter, 1) };
  }

  record.timestamps.push(now);
  return { limited: false, remaining: limit - record.timestamps.length };
}

/**
 * Catat satu hit tanpa mengecek batas (berguna untuk mencatat kegagalan
 * setelah proses verifikasi).
 */
export function recordHit(key: string): void {
  const now = Date.now();
  let record = store.get(key);
  if (!record) {
    record = { timestamps: [] };
    store.set(key, record);
  }
  record.timestamps.push(now);
}

/**
 * Deteksi IP asli client. Urutan prioritas:
 * 1. `fly-client-ip`   — header dari Fly.io proxy
 * 2. `x-forwarded-for` — IP pertama dari daftar
 * 3. Fallback `127.0.0.1`
 */
export function getClientIp(req: NextRequest): string {
  const flyIp = req.headers.get("fly-client-ip");
  if (flyIp) return flyIp.trim();

  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();

  return "127.0.0.1";
}
