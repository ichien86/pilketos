import { randomBytes, createHash } from "crypto";

/**
 * voteToken sengaja BUKAN JWT: string acak murni tanpa payload apa pun,
 * jadi kalaupun dicegat, ia tidak membawa klaim identitas atau data lain.
 * Hanya hash sha256-nya yang disimpan di DB (Bagian 3 dok. teknis v6).
 */
export function generateVoteToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Barcode bukti keluar (US-15/US-16) -- juga token opaque terpisah. */
export function generateBuktiToken(): string {
  return randomBytes(24).toString("hex");
}
