"use client";

import { useEffect, useRef, useState } from "react";

interface QrScannerProps {
  onResult: (text: string) => void;
  active: boolean;
}

// Pembungkus html5-qrcode -- akses kamera browser di semua titik scan panitia
// (identitas, exit) dan pemilih (QR bilik). Butuh HTTPS atau localhost
// (kebijakan getUserMedia), lihat PRASYARAT_PENGEMBANGAN.md.
export default function QrScanner({ onResult, active }: QrScannerProps) {
  const containerId = useRef(`qr-scanner-${Math.random().toString(36).slice(2)}`);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      const scanner = new Html5Qrcode(containerId.current);
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            onResult(decodedText);
          },
          () => {
            // decode error per-frame, diabaikan (normal saat kamera belum fokus ke QR)
          }
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal mengakses kamera");
      }
    })();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      if (scanner) {
        try {
          // scanner.stop() bisa throw SINKRON (bukan promise ter-reject) kalau
          // kamera gagal start (mis. tidak ada izin/kamera) -- scanner memang
          // belum pernah berjalan, aman diabaikan. try/catch di sini menangkap
          // itu; .catch() di bawah menangkap rejection async yang normal.
          scanner
            .stop()
            .then(() => scanner.clear())
            .catch(() => {});
        } catch {
          // idem -- scanner tidak pernah berjalan, tidak ada yang perlu dihentikan.
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div>
      <div
        id={containerId.current}
        className="relative w-full max-w-sm mx-auto aspect-square overflow-hidden rounded-lg border border-slate-300 bg-slate-900"
      />
      {error && <p className="text-red-600 text-sm mt-2">Kamera error: {error}</p>}
    </div>
  );
}
