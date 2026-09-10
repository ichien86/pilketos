"use client";

import { useMemo, useState } from "react";
import { extractWordFrequencies } from "@/lib/word-cloud";

interface PetaKataAlasanProps {
  alasanList: string[];
  labelKotakAtauTidak?: string;
}

const PALET_WARNA = [
  "text-blue-600 hover:text-blue-800 bg-blue-50/70 hover:bg-blue-100 border-blue-200",
  "text-emerald-600 hover:text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100 border-emerald-200",
  "text-amber-600 hover:text-amber-800 bg-amber-50/70 hover:bg-amber-100 border-amber-200",
  "text-purple-600 hover:text-purple-800 bg-purple-50/70 hover:bg-purple-100 border-purple-200",
  "text-rose-600 hover:text-rose-800 bg-rose-50/70 hover:bg-rose-100 border-rose-200",
  "text-cyan-600 hover:text-cyan-800 bg-cyan-50/70 hover:bg-cyan-100 border-cyan-200",
  "text-indigo-600 hover:text-indigo-800 bg-indigo-50/70 hover:bg-indigo-100 border-indigo-200",
  "text-teal-600 hover:text-teal-800 bg-teal-50/70 hover:bg-teal-100 border-teal-200",
];

export default function PetaKataAlasan({
  alasanList,
  labelKotakAtauTidak = "Tidak Memilih / Kotak Kosong",
}: PetaKataAlasanProps) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const wordFrequencies = useMemo(() => {
    return extractWordFrequencies(alasanList, 40);
  }, [alasanList]);

  const { minCount, maxCount } = useMemo(() => {
    if (wordFrequencies.length === 0) return { minCount: 1, maxCount: 1 };
    return {
      minCount: wordFrequencies[wordFrequencies.length - 1].count,
      maxCount: wordFrequencies[0].count,
    };
  }, [wordFrequencies]);

  // Hitung ukuran font proporsional (14px - 34px)
  function getFontSize(count: number): string {
    if (maxCount === minCount) return "1.1rem";
    const minSize = 0.875; // 14px
    const maxSize = 2.0; // 32px
    const scale = (count - minCount) / (maxCount - minCount);
    return `${(minSize + scale * (maxSize - minSize)).toFixed(2)}rem`;
  }

  // Filter teks alasan berdasarkan kata yang dipilih atau search query
  const filteredAlasan = useMemo(() => {
    const query = (selectedWord || searchQuery).toLowerCase().trim();
    if (!query) return alasanList;
    return alasanList.filter((item) => item.toLowerCase().includes(query));
  }, [alasanList, selectedWord, searchQuery]);

  if (alasanList.length === 0) {
    return (
      <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-500">
        <p className="font-semibold text-slate-700">Belum Ada Catatan Alasan</p>
        <p className="text-xs mt-1 text-slate-500">
          Belum ada pemilih yang memberikan alasan untuk opsi {labelKotakAtauTidak}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Metrik Singkat */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h4 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <span>☁️</span> Peta Kata Alasan {labelKotakAtauTidak}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Analisis frekuensi kata kunci dari {alasanList.length} pemilih (tercatat anonim)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full">
              {wordFrequencies.length} Kata Kunci
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full">
              {alasanList.length} Suara
            </span>
          </div>
        </div>

        {/* Kanvas Peta Kata (Word Cloud) */}
        {wordFrequencies.length > 0 ? (
          <div className="py-6 px-2 sm:px-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3.5 min-h-[220px] bg-gradient-to-b from-slate-50/50 to-white rounded-lg my-3 border border-slate-100">
            {wordFrequencies.map((wf, idx) => {
              const isSelected = selectedWord?.toLowerCase() === wf.text.toLowerCase();
              const colorClass = PALET_WARNA[idx % PALET_WARNA.length];
              const fontSize = getFontSize(wf.count);

              return (
                <button
                  key={wf.text}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setSelectedWord(null);
                    } else {
                      setSelectedWord(wf.text);
                      setSearchQuery("");
                    }
                  }}
                  style={{ fontSize }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? "bg-slate-900 text-white border-slate-900 shadow-md scale-105 ring-2 ring-slate-400/50"
                      : `${colorClass} shadow-xs hover:scale-105`
                  }`}
                  title={`${wf.text}: muncul ${wf.count} kali (${wf.percentage}% dari kata kunci)`}
                >
                  <span className="font-bold tracking-tight">{wf.text}</span>
                  <span
                    className={`text-[0.65em] px-1.5 py-0.2 rounded-full font-semibold ${
                      isSelected
                        ? "bg-slate-700 text-slate-200"
                        : "bg-white/80 text-slate-600 border border-slate-200/50"
                    }`}
                  >
                    {wf.count}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            Kata kunci tidak cukup bervariasi untuk membentuk peta kata.
          </div>
        )}

        {/* Top 5 Kata Kunci */}
        {wordFrequencies.length > 0 && (
          <div className="pt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-600">Kata Paling Sering:</span>
            {wordFrequencies.slice(0, 5).map((item, i) => (
              <span
                key={item.text}
                onClick={() => {
                  setSelectedWord(item.text);
                  setSearchQuery("");
                }}
                className="cursor-pointer font-medium text-slate-700 hover:text-blue-600 hover:underline bg-slate-100 px-2 py-0.5 rounded"
              >
                #{i + 1} {item.text} ({item.count})
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Penjelajah Alasan & Pencarian */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h5 className="font-bold text-slate-800 text-sm">
              Daftar Alasan Pemilih
            </h5>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
              {filteredAlasan.length} dari {alasanList.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Cari dalam alasan..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedWord(null);
              }}
              className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 w-full sm:w-48"
            />
            {(selectedWord || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedWord(null);
                  setSearchQuery("");
                }}
                className="text-xs text-slate-500 hover:text-slate-800 underline px-1 shrink-0"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {selectedWord && (
          <div className="text-xs bg-blue-50 text-blue-800 px-3 py-1.5 rounded-lg flex items-center justify-between">
            <span>
              Menampilkan alasan yang memuat kata kunci: <strong>&ldquo;{selectedWord}&rdquo;</strong>
            </span>
            <button
              type="button"
              onClick={() => setSelectedWord(null)}
              className="font-bold text-blue-700 hover:text-blue-900 ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* List Teks Alasan */}
        <div className="max-h-72 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
          {filteredAlasan.length > 0 ? (
            filteredAlasan.map((alasan, index) => {
              const activeTerm = (selectedWord || searchQuery).trim();
              return (
                <div key={index} className="pt-2 text-xs text-slate-700 leading-relaxed flex items-start gap-2">
                  <span className="text-slate-400 font-mono text-[10px] pt-0.5 select-none shrink-0">
                    #{index + 1}
                  </span>
                  <div className="bg-slate-50/80 hover:bg-slate-100/80 p-2.5 rounded-lg border border-slate-100 w-full transition-colors">
                    {activeTerm ? (
                      <HighlightMatch text={alasan} match={activeTerm} />
                    ) : (
                      <span>&ldquo;{alasan}&rdquo;</span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-6 text-center text-xs text-slate-400">
              Tidak ada alasan yang cocok dengan kata kunci tersebut.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HighlightMatch({ text, match }: { text: string; match: string }) {
  if (!match) return <span>&ldquo;{text}&rdquo;</span>;

  const parts = text.split(new RegExp(`(${match})`, "gi"));
  return (
    <span>
      &ldquo;
      {parts.map((part, i) =>
        part.toLowerCase() === match.toLowerCase() ? (
          <mark key={i} className="bg-amber-200 text-amber-900 px-0.5 rounded font-semibold">
            {part}
          </mark>
        ) : (
          part
        )
      )}
      &rdquo;
    </span>
  );
}

