/**
 * Utilitas untuk ekstraksi kata kunci dan pembersihan stop words Bahasa Indonesia
 * guna menghasilkan Peta Kata (Word Cloud) dari alasan Tidak Memilih / Kotak Kosong.
 */

export interface WordFrequency {
  text: string;
  count: number;
  percentage: number;
}

// Daftar stop words / kata tugas & kata sambung umum dalam Bahasa Indonesia
const STOP_WORDS = new Set([
  "yang", "dan", "di", "ke", "dari", "untuk", "pada", "adalah", "ini", "itu",
  "karena", "saya", "aku", "bisa", "tidak", "jadi", "ada", "mau", "dengan",
  "akan", "juga", "oleh", "atau", "hanya", "saja", "kalau", "jika", "lagi",
  "sudah", "belum", "sangat", "lebih", "nya", "dalam", "bagi", "secara",
  "tentang", "seperti", "agar", "supaya", "kita", "kami", "mereka", "dia",
  "kamu", "bukan", "pun", "antara", "tapi", "namun", "sehingga", "serta",
  "dsb", "dkk", "dll", "yg", "dg", "dgn", "dlm", "sm", "sama", "aja", "tuh",
  "sih", "kan", "kok", "dong", "deh", "bila", "ketika", "saat", "olehnya",
  "bahwa", "maka", "tentu", "mungkin", "agak", "cukup", "terlalu", "pula",
  "selain", "walau", "meski", "walaupun", "meskipun", "sebab", "oleh", "bagi",
  "kepadanya", "kepada", "terhadap", "tanpa", "hingga", "sampai", "sejak",
  "merupakan", "yaitu", "yakni", "seluruh", "setiap", "semua", "masing",
  "punya", "banyak", "sedikit", "paling", "kurang", "sedang", "harus", "ingin",
  "boleh", "dapat", "masih", "pernah", "jangan", "tak", "tiada", "belumlah",
  "begitu", "begini", "demikian", "mana", "siapa", "apa", "kenapa", "mengapa",
  "bagaimana", "kapan", "dimana", "kemana", "dari mana",
]);

/**
 * Ekstraksi frekuensi kata dari kumpulan teks alasan abstain/tidak memilih.
 *
 * @param texts - Array teks alasan pemilih
 * @param maxWords - Batas maksimal jumlah kata yang dikembalikan (default 40)
 * @returns Array WordFrequency terurut dari yang paling sering muncul
 */
export function extractWordFrequencies(
  texts: string[],
  maxWords = 40
): WordFrequency[] {
  const counts = new Map<string, number>();
  let totalWords = 0;

  for (const rawText of texts) {
    if (!rawText || typeof rawText !== "string") continue;

    // Bersihkan karakter selain huruf, angka, dan tanda hubung
    const tokens = rawText
      .toLowerCase()
      .replace(/[^a-z0-9\s\-]/g, " ")
      .split(/\s+/);

    for (let token of tokens) {
      // Hapus tanda hubung di awal/akhir jika ada
      token = token.replace(/^-+|-+$/g, "").trim();

      // Abaikan kata terlalu pendek (< 3 karakter) atau angka murni
      if (token.length < 3 || /^\d+$/.test(token)) continue;

      // Abaikan stop words
      if (STOP_WORDS.has(token)) continue;

      counts.set(token, (counts.get(token) ?? 0) + 1);
      totalWords++;
    }
  }

  if (totalWords === 0) return [];

  return Array.from(counts.entries())
    .map(([text, count]) => ({
      text,
      count,
      percentage: Math.round((count / totalWords) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, maxWords);
}

