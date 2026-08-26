import path from "path";

/** Direktori dasar tempat semua file upload (foto/video) disimpan di disk. */
export function resolveUploadBaseDir(): string {
  const uploadDir = process.env.UPLOAD_DIR ?? "./public/uploads";
  return path.join(process.cwd(), uploadDir.replace(/^\.\//, ""));
}

/**
 * Balikkan URL publik (mis. "/api/uploads/foto/xxx.png") jadi path absolut
 * di disk -- dipakai saat perlu menghapus file fisik (lihat matikanUjiCoba
 * di lib/mode.ts). null kalau URL-nya bukan format upload yang dikenal atau
 * mencoba keluar dari direktori upload (path traversal).
 */
export function uploadUrlToPath(url: string): string | null {
  const match = /^\/api\/uploads\/(.+)$/.exec(url);
  if (!match) return null;
  const segments = match[1].split("/");
  if (segments.some((s) => !s || s.includes("..") || s.includes("\\"))) return null;
  const baseDir = resolveUploadBaseDir();
  const filePath = path.join(baseDir, ...segments);
  if (!filePath.startsWith(baseDir + path.sep)) return null;
  return filePath;
}
