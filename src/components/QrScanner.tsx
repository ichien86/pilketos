"use client";

import { useEffect, useId, useRef, useState } from "react";

interface QrScannerProps {
  onResult: (text: string) => void;
  active: boolean;
  /**
   * true -- paksa kamera belakang langsung (facingMode exact), TANPA dropdown
   * pilihan kamera. Dipakai pemilih di layar scan QR bilik: yang discan ada
   * di depan mereka (nempel di bilik), bukan diri sendiri, jadi kamera depan
   * tidak masuk akal dan sengaja tidak ditawarkan sebagai pilihan.
   *
   * false/default -- tampilkan dropdown pilih kamera (lewat
   * Html5Qrcode.getCameras()). Dipakai panitia, yang device-nya bisa apa
   * saja (HP, laptop, webcam eksternal) -- mereka yang tahu kamera mana yang
   * benar di device masing-masing.
   */
  wajibKameraBelakang?: boolean;
}

const LAST_CAMERA_KEY = "pilketos_kamera_id";
const SCAN_CONFIG = { fps: 10, qrbox: { width: 250, height: 250 } };

function formatCameraError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : null;
  const msg = e instanceof Error ? e.message : String(e);
  return name ? `${name}: ${msg}` : msg;
}

function tebakKameraBelakang(cameras: Array<{ id: string; label: string }>): string | undefined {
  return cameras.find((c) => /back|belakang|rear|environment/i.test(c.label))?.id;
}

// Pembungkus html5-qrcode -- akses kamera browser di semua titik scan panitia
// (identitas, exit) dan pemilih (QR bilik). Butuh HTTPS atau localhost
// (kebijakan getUserMedia), lihat PRASYARAT_PENGEMBANGAN.md.
//
// Daftar kamera diambil eksplisit lewat Html5Qrcode.getCameras() dan dipilih
// pakai ID kamera langsung (bukan facingMode "environment"/"user") -- device
// dengan lebih dari satu kamera (laptop + webcam eksternal, HP dengan kamera
// makro/ultrawide terpisah, dst) bisa pilih sendiri lewat dropdown, tersimpan
// per-browser lewat localStorage supaya tidak perlu pilih ulang tiap scan.
export default function QrScanner({ onResult, active, wajibKameraBelakang = false }: QrScannerProps) {
  // useId() (BUKAN Math.random()) -- komponen ini "use client" tapi TETAP
  // di-server-render dulu oleh Next.js sebelum hydrate di browser. Math.random()
  // menghasilkan nilai beda antara render server & client, jadi id div yang
  // dicari lib ini saat efek jalan bisa tidak pernah cocok dengan yang ada di
  // DOM ("HTML Element with id=... not found") -- useId() dijamin sama persis
  // di server maupun client. Titik dua bawaan useId() dibuang, jaga-jaga
  // kalau ada kode yang memakainya sebagai selector CSS.
  const containerId = `qr-scanner-${useId().replace(/:/g, "")}`;
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  async function mulaiKamera(Html5Qrcode: typeof import("html5-qrcode").Html5Qrcode, id: string) {
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;
    await scanner.start(id, SCAN_CONFIG, (decodedText) => onResult(decodedText), () => {
      // decode error per-frame, diabaikan (normal saat kamera belum fokus ke QR)
    });
  }

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

        if (wajibKameraBelakang) {
          // Constraint langsung ke browser, TANPA enumerasi/dropdown -- kalau
          // device ini genuinely tidak punya kamera belakang, sengaja gagal
          // dengan pesan error, bukan diam-diam jatuh ke kamera depan.
          const scanner = new Html5Qrcode(containerId);
          scannerRef.current = scanner;
          await scanner.start(
            { facingMode: { exact: "environment" } },
            SCAN_CONFIG,
            (decodedText) => onResult(decodedText),
            () => {
              // decode error per-frame, diabaikan (normal saat kamera belum fokus ke QR)
            }
          );
          return;
        }

        // Panggilan ini SEKALIGUS yang memicu prompt izin kamera kalau belum
        // pernah -- kalau ditolak/gagal, error aslinya (bukan array kosong)
        // yang mau kita tangkap di bawah, jadi TIDAK di-.catch(() => []) di sini.
        const daftar = await Html5Qrcode.getCameras();
        if (cancelled) return;
        setCameras(daftar);
        if (daftar.length === 0) throw new Error("Tidak ada kamera terdeteksi di perangkat ini.");

        const tersimpan = localStorage.getItem(LAST_CAMERA_KEY);
        const idTerpilih =
          (tersimpan && daftar.some((c) => c.id === tersimpan) ? tersimpan : undefined) ??
          tebakKameraBelakang(daftar) ??
          daftar[0].id;

        await mulaiKamera(Html5Qrcode, idTerpilih);
        if (cancelled) return;
        setCameraId(idTerpilih);
        localStorage.setItem(LAST_CAMERA_KEY, idTerpilih);
      } catch (e) {
        if (!cancelled) setError(formatCameraError(e));
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
  }, [active, wajibKameraBelakang]);

  async function gantiKamera(id: string) {
    if (!id || id === cameraId || switching) return;
    setSwitching(true);
    setError(null);
    try {
      const scanner = scannerRef.current;
      if (scanner) {
        await scanner.stop().catch(() => {});
        try {
          scanner.clear();
        } catch {
          // aman diabaikan -- lihat catatan yang sama di cleanup effect.
        }
      }
      const { Html5Qrcode } = await import("html5-qrcode");
      await mulaiKamera(Html5Qrcode, id);
      setCameraId(id);
      localStorage.setItem(LAST_CAMERA_KEY, id);
    } catch (e) {
      setError(formatCameraError(e));
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div>
      {!wajibKameraBelakang && cameras.length > 1 && (
        <select
          value={cameraId ?? ""}
          disabled={switching}
          onChange={(e) => gantiKamera(e.target.value)}
          className="w-full max-w-sm mx-auto mb-2 block border rounded-lg px-2 py-1.5 text-sm disabled:opacity-50"
        >
          {cameras.map((c, i) => (
            <option key={c.id} value={c.id}>
              {c.label || `Kamera ${i + 1}`}
            </option>
          ))}
        </select>
      )}
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
