"use client";

import { useEffect, useState } from "react";
import LuberJurdilModal from "./LuberJurdilModal";

const SEEN_KEY = "pilketos_luber_jurdil_seen";

// Tombol info "i" yang menyala (halo pulsing lewat animate-lj-glow di
// globals.css), tampil di login dan seluruh halaman pemilih. Dengan
// autoShowOnce=true (dipakai di dashboard /pemilih), modal otomatis terbuka
// sekali di kunjungan PERTAMA pemilih ke halaman itu -- yang secara alami
// selalu persis setelah aktivasi, karena /pemilih baru bisa diakses sesudah
// sesi login ada, dan sesi pertama pemilih dibuat oleh endpoint aktivasi itu
// sendiri. Ditandai "sudah lihat" di localStorage supaya tidak muncul lagi
// otomatis sesudahnya (baik dibuka otomatis maupun manual lewat tombolnya).
export default function InfoLuberJurdilButton({ autoShowOnce = false }: { autoShowOnce?: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!autoShowOnce) return;
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      // localStorage tidak tersedia (mis. mode privat) -- tombol info tetap bisa dibuka manual
    }
  }, [autoShowOnce]);

  function close() {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // diamkan -- kegagalan menandai "sudah lihat" tidak fatal
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Tentang prinsip Luber Jurdil aplikasi ini"
        title="Tentang prinsip Luber Jurdil aplikasi ini"
        className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0 animate-lj-glow"
      >
        i
      </button>
      <LuberJurdilModal open={open} onClose={close} />
    </>
  );
}
