"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function DisplayQr({ payload, size = 240 }: { payload: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: size }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [payload, size]);

  if (!dataUrl) {
    return <div style={{ width: size, height: size }} className="bg-slate-100 animate-pulse rounded-lg" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt="QR code" width={size} height={size} className="rounded-lg border border-slate-200" />;
}
