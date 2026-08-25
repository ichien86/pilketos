"use client";

import { useEffect, useId, useRef, useState } from "react";

interface QrScannerProps {
  onResult: (text: string) => void;
  active: boolean;
}

function formatCameraError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : null;
  const msg = e instanceof Error ? e.message : String(e);
  return name ? `${name}: ${msg}` : msg;
}

// Pembungkus html5-qrcode -- akses kamera browser di semua titik scan panitia
// (identitas, exit) dan pemilih (QR bilik). Butuh HTTPS atau localhost
// (kebijakan getUserMedia), lihat PRASYARAT_PENGEMBANGAN.md.
export default function QrScanner({ onResult, active }: QrScannerProps) {
  // useId() (BUKAN Math.random()) -- komponen ini "use client" tapi TETAP
  // di-server-render dulu oleh Next.js sebelum hydrate di browser. Math.random()
  // menghasilkan nilai beda antara render server & client, jadi id div yang
  // dicari lib ini saat efek jalan bisa tidak pernah cocok dengan yang ada di
  // DOM ("HTML Element with id=... not found") -- useId() dijamin sama persis
  // di server maupun client.
  // useId() biasanya berbentuk ":r0:" -- titik dua dibuang supaya aman kalau
  // ada kode (di sini atau di dalam html5-qrcode) yang memakainya sebagai
  // selector CSS (mis. `#${id}`), bukan cuma getElementById biasa.
  const containerId = `qr-scanner-${useId().replace(/:/g, "")}`;
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            "Browser ini tidak mendukung akses kamera (atau halaman tidak dibuka lewat HTTPS) -- coba buka lewat browser biasa (Chrome/Safari), bukan lewat aplikasi lain."
          );
        }
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        const onSuccess = (decodedText: string) => onResult(decodedText);
        const onDecodeError = () => {
          // decode error per-frame, diabaikan (normal saat kamera belum fokus ke QR)
        };
        // Konstruktor Html5Qrcode SENDIRI bisa throw (bukan cuma .start()), mis.
        // kalau browser/webview tidak benar-benar mendukung MediaDevices --
        // makanya ini ikut di dalam try, bukan cuma .start() di bawah. Kalau
        // ini luput, kegagalan jadi unhandled rejection: layar tetap kosong
        // (kotak hitam) TANPA pesan error dan TANPA browser sempat minta izin
        // kamera sama sekali, karena getUserMedia belum sempat dipanggil.
        try {
          // "ideal" (bukan "exact") -- lebih disukai kamera belakang, TAPI
          // tetap boleh browser pilih kamera lain kalau tidak ada yang persis
          // menandai dirinya "environment" (banyak laptop/webcam eksternal
          // tidak melaporkan facingMode sama sekali).
          const scanner = new Html5Qrcode(containerId);
          scannerRef.current = scanner;
          await scanner.start({ facingMode: { ideal: "environment" } }, config, onSuccess, onDecodeError);
        } catch (eEnvironment) {
          if (cancelled) return;
          // Fallback: kamera APA PUN yang tersedia -- device tanpa kamera
          // belakang (laptop) tetap bisa dipakai, bukan gagal total. Ini
          // penyebab paling umum "izin sudah diizinkan tapi tetap gagal":
          // constraint facingMode tidak match kamera yang ada, BUKAN masalah
          // izin sama sekali.
          //
          // SENGAJA instance Html5Qrcode BARU di sini, bukan scanner.start()
          // lagi di instance yang gagal -- instance yang gagal state
          // internalnya masih "under transition" dari percobaan pertama,
          // dan html5-qrcode menolak transisi baru di atasnya ("Cannot
          // transition to a new state, already under transition").
          const cameras = await Html5Qrcode.getCameras().catch(() => []);
          if (cameras.length === 0) throw eEnvironment;
          // Bersihkan sisa DOM dari percobaan pertama (video/elemen yang
          // sempat dibuat html5-qrcode di dalam container) sebelum instance
          // baru dipasang di container yang sama.
          try {
            scannerRef.current?.clear();
          } catch {
            // idem seperti di cleanup effect -- aman diabaikan.
          }
          const scannerFallback = new Html5Qrcode(containerId);
          scannerRef.current = scannerFallback;
          await scannerFallback.start(cameras[0].id, config, onSuccess, onDecodeError);
        }
      } catch (e) {
        setError(formatCameraError(e));
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
        id={containerId}
        className="relative w-full max-w-sm mx-auto aspect-square overflow-hidden rounded-lg border border-slate-300 bg-slate-900"
      >
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}
      </div>
      {error && (
        <p className="text-red-600 text-xs mt-2">
          Kalau ini muncul terus, cek izin kamera untuk situs ini di pengaturan browser (biasanya lewat ikon gembok/kamera di sebelah alamat situs).
        </p>
      )}
    </div>
  );
}
