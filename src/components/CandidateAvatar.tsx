"use client";

import { useState } from "react";

// Thumbnail identitas kecil -- sengaja kecil & sekunder supaya visi/misi yang
// jadi fokus utama layar pemilihan, bukan foto (lihat halaman bilik & sosialisasi).
export default function CandidateAvatar({ nama, foto, size = 40 }: { nama: string; foto: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initial = nama.trim().charAt(0).toUpperCase() || "?";

  if (!foto || broken) {
    return (
      <div
        className="rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-semibold shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {initial}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={foto}
      alt={nama}
      onError={() => setBroken(true)}
      className="rounded-full object-cover shrink-0 border border-slate-200"
      style={{ width: size, height: size }}
    />
  );
}
