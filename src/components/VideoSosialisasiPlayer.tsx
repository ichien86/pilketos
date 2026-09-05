"use client";

import { useRef, useState, useEffect } from "react";

interface VideoSosialisasiPlayerProps {
  videoId: string;
  src: string;
  sudahDitonton: boolean;
  onComplete: () => Promise<void>;
}

export default function VideoSosialisasiPlayer({
  src,
  sudahDitonton,
  onComplete,
}: VideoSosialisasiPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const maxWatchedRef = useRef<number>(0);
  const [warning, setWarning] = useState<string | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showWarning = (msg: string) => {
    setWarning(msg);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    warningTimerRef.current = setTimeout(() => setWarning(null), 3000);
  };

  useEffect(() => {
    return () => {
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, []);

  // 1. Cegah pengguna menggeser maju (scrubbing/seeking forward)
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    if (!sudahDitonton) {
      // Jika posisi lompat lebih dari 1.5 detik ke depan dari yang pernah ditonton
      if (video.currentTime > maxWatchedRef.current + 1.5) {
        video.currentTime = maxWatchedRef.current;
        showWarning("⚠️ Video tidak dapat dipercepat atau dilompati.");
        return;
      }
      if (video.currentTime > maxWatchedRef.current) {
        maxWatchedRef.current = video.currentTime;
      }
    }
  };

  const handleSeeking = () => {
    const video = videoRef.current;
    if (!video) return;

    if (!sudahDitonton && video.currentTime > maxWatchedRef.current + 1) {
      video.currentTime = maxWatchedRef.current;
      showWarning("⚠️ Video tidak dapat dilompati. Silakan tonton sampai selesai.");
    }
  };

  // 2. Cegah percepatan playback (lock ke 1.0x)
  const handleRateChange = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.playbackRate !== 1) {
      video.playbackRate = 1;
      showWarning("⚠️ Kecepatan video dikunci pada 1.0x normal.");
    }
  };

  // 3. Blokir pintasan keyboard (panah kanan, L, dsb.)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLVideoElement>) => {
    if (
      !sudahDitonton &&
      (e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "l" || e.key === "L")
    ) {
      e.preventDefault();
      showWarning("⚠️ Pintasan mempercepat video dinonaktifkan.");
    }
  };

  // 4. Validasi durasi saat video selesai
  const handleEnded = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (!sudahDitonton) {
      const duration = video.duration || 0;
      // Pastikan telah menonton setidaknya 90% dari durasi video
      if (duration > 0 && maxWatchedRef.current < duration * 0.9) {
        showWarning("⚠️ Silakan tonton video secara utuh hingga selesai.");
        return;
      }
      await onComplete();
    }
  };

  return (
    <div className="relative">
      <video
        ref={videoRef}
        src={src}
        controls
        playsInline
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        onTimeUpdate={handleTimeUpdate}
        onSeeking={handleSeeking}
        onRateChange={handleRateChange}
        onEnded={handleEnded}
        onKeyDown={handleKeyDown}
        className="w-full rounded-lg bg-black"
      />
      {warning && (
        <div className="absolute top-2 left-2 right-2 bg-amber-600/90 text-white text-xs px-3 py-1.5 rounded shadow flex items-center justify-between backdrop-blur-sm z-10">
          <span>{warning}</span>
        </div>
      )}
      {!sudahDitonton ? (
        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 px-1">
          <span>🔒 Kecepatan dikunci (1.0x) • Wajib tonton berurutan</span>
          <span>Anti-Skip Aktif</span>
        </div>
      ) : (
        <div className="text-[11px] text-emerald-600 mt-1 px-1">
          ✓ Sudah ditonton (dapat diulang atau digeser bebas)
        </div>
      )}
    </div>
  );
}
