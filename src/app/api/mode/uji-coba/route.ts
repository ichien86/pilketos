import { NextRequest, NextResponse } from "next/server";
import { errorJson } from "@/lib/api";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { isUjiCobaAktif, aktifkanUjiCoba, matikanUjiCoba, ModeGateError } from "@/lib/mode";

export const dynamic = "force-dynamic";

// Status mode uji coba -- publik (tanpa login) sama seperti /api/fase,
// supaya banner "MODE UJI COBA" bisa tampil untuk semua orang di semua
// halaman, bukan cuma yang punya akun panitia/admin.
export async function GET() {
  return NextResponse.json({ aktif: await isUjiCobaAktif() });
}

// Admin-only: nyalakan/matikan mode uji coba. Menyalakan menyiapkan
// database sandbox dari nol (kelima fase "belum_dibuka", checklist kosong).
// Mematikan menghapus TOTAL database sandbox itu -- semua data uji coba
// DAN status kelima fase-nya sendiri, sekaligus.
export async function POST(req: NextRequest) {
  const claims = getSessionFromRequest(req);
  if (!requireRole(claims, ["admin"])) return errorJson("Tidak diizinkan", 403);

  const body = await req.json().catch(() => null);
  const aktif = body?.aktif === true;

  try {
    if (aktif) {
      await aktifkanUjiCoba();
    } else {
      await matikanUjiCoba();
    }
  } catch (e) {
    if (e instanceof ModeGateError) return errorJson(e.message, 409);
    throw e;
  }

  return NextResponse.json({ aktif });
}
