/** Satu baris misi (dipisah Enter saat admin input) = satu poin bernomor saat ditampilkan. */
export function splitMisi(misi: string | null): string[] {
  if (!misi) return [];
  return misi
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
