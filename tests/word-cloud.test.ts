import { describe, it, expect } from "vitest";
import { extractWordFrequencies } from "@/lib/word-cloud";

describe("Word Cloud Utility (extractWordFrequencies)", () => {
  it("mengabaikan teks kosong dan null", () => {
    const result = extractWordFrequencies(["", "   ", null as unknown as string]);
    expect(result).toEqual([]);
  });

  it("memfilter stop words Bahasa Indonesia dan menghitung frekuensi", () => {
    const texts = [
      "Visi dan misi calon tidak sesuai dengan harapan saya",
      "Calon belum meyakinkan visi nya",
      "Saya kecewa dengan program kerja kedua paslon",
    ];

    const frequencies = extractWordFrequencies(texts);
    const map = new Map(frequencies.map((f) => [f.text, f.count]));

    // "visi" muncul 2 kali
    expect(map.get("visi")).toBe(2);
    // "misi", "calon", "harapan", "meyakinkan", "kecewa", "program", "kerja", "paslon"
    expect(map.get("harapan")).toBe(1);
    expect(map.get("kecewa")).toBe(1);

    // Stop words harus tereliminasi
    expect(map.has("dan")).toBe(false);
    expect(map.has("di")).toBe(false);
    expect(map.has("dengan")).toBe(false);
    expect(map.has("saya")).toBe(false);
    expect(map.has("tidak")).toBe(false);
    expect(map.has("belum")).toBe(false);
  });

  it("mengurutkan kata dari frekuensi terbanyak", () => {
    const texts = [
      "netral netral netral",
      "netral amanah amanah",
      "terpercaya",
    ];

    const frequencies = extractWordFrequencies(texts);
    expect(frequencies[0].text).toBe("netral");
    expect(frequencies[0].count).toBe(4);
    expect(frequencies[1].text).toBe("amanah");
    expect(frequencies[1].count).toBe(2);
    expect(frequencies[2].text).toBe("terpercaya");
    expect(frequencies[2].count).toBe(1);
  });

  it("memotong kata sesuai maxWords", () => {
    const texts = [
      "satu dua tiga empat lima enam tujuh delapan sembilan sepuluh",
    ];
    const frequencies = extractWordFrequencies(texts, 3);
    expect(frequencies.length).toBe(3);
  });
});

