"use client";

import { useEffect } from "react";

interface Prinsip {
  judul: string;
  penjelasan: string;
}

// Setiap penjelasan merujuk mekanisme yang SUNGGUHAN diterapkan di aplikasi
// ini (bukan janji generik) -- lihat masing-masing bagian kode yang dirujuk
// di komentar untuk pembaca yang menelusuri sumbernya.
const PRINSIP: Prinsip[] = [
  {
    judul: "Langsung",
    penjelasan: "Anda memilih sendiri lewat HP Anda di bilik suara -- tidak diwakilkan siapa pun.",
  },
  {
    judul: "Umum",
    penjelasan: "Semua yang terdaftar di Data Pemilih Tetap, siswa maupun guru, berhak memilih tanpa kecuali.",
  },
  {
    judul: "Bebas",
    penjelasan: "Anda memilih sendirian di dalam bilik, tanpa diawasi atau diarahkan siapa pun.",
  },
  {
    judul: "Rahasia",
    penjelasan: "Sistem ini tidak pernah menyimpan siapa memilih siapa -- bahkan panitia dan admin tidak bisa melihat pilihan Anda.",
  },
  {
    judul: "Jujur",
    penjelasan: "Setiap barcode/token hanya berlaku sekali pakai, dan jumlah suara direkonsiliasi otomatis supaya tidak ada kejanggalan.",
  },
  {
    judul: "Adil",
    penjelasan: "Anda wajib mengenal semua kandidat (menonton video visi-misi) sebelum memilih, dan aturannya sama untuk semua pemilih.",
  },
];

export default function LuberJurdilModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 animate-lj-fade"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lj-title"
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-lj-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-1">
          <h2 id="lj-title" className="text-xl font-bold tracking-tight text-slate-900">LUBER JURDIL</h2>
          <p className="text-sm text-slate-500">Prinsip yang sungguh-sungguh diterapkan di aplikasi e-voting ini</p>
        </div>

        <div className="space-y-3">
          {PRINSIP.map((p, i) => (
            <div key={p.judul} className="flex gap-3 items-start animate-lj-item" style={{ animationDelay: `${150 + i * 90}ms` }}>
              <div className="shrink-0 w-8 h-8 rounded-full bg-slate-900 text-white text-sm font-bold flex items-center justify-center">
                {i + 1}
              </div>
              <div>
                <p className="font-semibold text-slate-800">{p.judul}</p>
                <p className="text-sm text-slate-500">{p.penjelasan}</p>
              </div>
            </div>
          ))}
        </div>

        <button onClick={onClose} className="w-full bg-slate-900 text-white rounded-lg py-2.5 font-medium">
          Mengerti
        </button>
      </div>
    </div>
  );
}
