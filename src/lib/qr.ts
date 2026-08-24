import QRCode from "qrcode";

/** Render payload string jadi QR code data-URL (PNG base64) untuk ditampilkan di UI. */
export async function toQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 320 });
}
