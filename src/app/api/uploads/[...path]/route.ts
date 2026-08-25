import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
};

/**
 * Next.js `next start` mengindeks isi /public HANYA sekali saat proses boot
 * (`this.publicFiles`), jadi file yang ditulis ke volume SETELAH server
 * jalan (foto/video baru diunggah) selalu 404 lewat static serving bawaan --
 * bukan bug penyimpanan, filenya memang ada di disk. Route handler ini baca
 * ulang dari disk di setiap request supaya file baru langsung bisa diakses
 * tanpa perlu restart proses.
 */
export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  const segments = params.path ?? [];
  if (segments.length === 0 || segments.some((s) => s.includes("..") || s.includes("/") || s.includes("\\"))) {
    return NextResponse.json({ error: "Path tidak valid" }, { status: 400 });
  }

  const uploadDir = process.env.UPLOAD_DIR ?? "./public/uploads";
  const baseDir = path.join(process.cwd(), uploadDir.replace(/^\.\//, ""));
  const filePath = path.join(baseDir, ...segments);

  if (!filePath.startsWith(baseDir + path.sep)) {
    return NextResponse.json({ error: "Path tidak valid" }, { status: 400 });
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("bukan file");
    const buffer = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Content-Length": String(info.size),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  }
}
