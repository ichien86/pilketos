"use client";

import { useMemo, useState } from "react";

export interface ItemHasil {
  kandidat_id?: string;
  nomor_urut?: number | null;
  nama?: string;
  nama_ketua?: string;
  nama_wakil?: string;
  jumlah_suara: number;
}

interface HasilChartsProps {
  perPaslon: ItemHasil[];
  totalSuara: number;
  jumlahAbstain?: number;
  title?: string;
}

const WARNA_PASLON = [
  "#2563EB", // Biru (No. 1)
  "#059669", // Hijau Emerald (No. 2)
  "#D97706", // Oranye Amber (No. 3)
  "#7C3AED", // Ungu Violet (No. 4)
  "#DB2777", // Pink Rose (No. 5)
  "#0891B2", // Cyan (No. 6)
];
const WARNA_ABSTAIN = "#64748B"; // Abu-abu Slate

export default function HasilCharts({
  perPaslon,
  totalSuara,
  jumlahAbstain = 0,
  title = "Visualisasi Perolehan Suara",
}: HasilChartsProps) {
  const [tabGrafik, setTabGrafik] = useState<"batang" | "lingkaran">("batang");

  const chartData = useMemo(() => {
    const list: Array<{
      id: string;
      label: string;
      jumlah: number;
      persentase: number;
      warna: string;
    }> = [];

    perPaslon.forEach((p, idx) => {
      // Jika nomor_urut === 0 atau kandidat_id === "abstain", sudah merupakan abstain
      if (p.kandidat_id === "abstain" || p.nomor_urut === 0) return;

      const nama =
        p.nama ??
        (p.nama_ketua && p.nama_wakil
          ? `${p.nama_ketua} & ${p.nama_wakil}`
          : `Paslon ${p.nomor_urut ?? idx + 1}`);
      const label = p.nomor_urut ? `No. ${p.nomor_urut} - ${nama}` : nama;
      const persentase = totalSuara > 0 ? (p.jumlah_suara / totalSuara) * 100 : 0;

      list.push({
        id: p.kandidat_id ?? `paslon-${idx}`,
        label,
        jumlah: p.jumlah_suara,
        persentase,
        warna: WARNA_PASLON[idx % WARNA_PASLON.length],
      });
    });

    // Cek apakah abstain sudah ada di perPaslon atau dari jumlahAbstain
    const abstainFromList = perPaslon.find(
      (p) => p.kandidat_id === "abstain" || p.nomor_urut === 0
    );
    const totalAbstain = abstainFromList ? abstainFromList.jumlah_suara : jumlahAbstain;

    if (totalAbstain > 0) {
      const realPaslonCount = perPaslon.filter(
        (p) => p.kandidat_id !== "abstain" && p.nomor_urut !== 0
      ).length;
      const labelAbstain = realPaslonCount === 1 ? "Kotak Kosong" : "Tidak Memilih";
      const persentase = totalSuara > 0 ? (totalAbstain / totalSuara) * 100 : 0;
      list.push({
        id: "abstain",
        label: labelAbstain,
        jumlah: totalAbstain,
        persentase,
        warna: WARNA_ABSTAIN,
      });
    }

    return list;
  }, [perPaslon, totalSuara, jumlahAbstain]);

  if (totalSuara === 0) {
    return (
      <div className="bg-white rounded-xl shadow p-6 text-center text-slate-500 text-sm">
        Belum ada suara yang masuk untuk divisualisasikan.
      </div>
    );
  }

  // Perhitungan lingkaran/donut chart
  const radius = 68;
  const keliling = 2 * Math.PI * radius;
  let akumulasiPersen = 0;

  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-bold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Total {totalSuara} suara sah tercatat
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setTabGrafik("batang")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              tabGrafik === "batang"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            📊 Grafik Batang
          </button>
          <button
            type="button"
            onClick={() => setTabGrafik("lingkaran")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              tabGrafik === "lingkaran"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            🍩 Grafik Lingkaran
          </button>
        </div>
      </div>

      {tabGrafik === "batang" ? (
        /* GRAFIK BATANG */
        <div className="space-y-4 pt-1">
          {chartData.map((item) => (
            <div key={item.id} className="space-y-1.5">
              <div className="flex justify-between items-baseline text-xs sm:text-sm">
                <span className="font-medium text-slate-700 truncate mr-2">
                  {item.label}
                </span>
                <span className="font-bold text-slate-900 shrink-0">
                  {item.jumlah.toLocaleString("id-ID")}{" "}
                  <span className="font-normal text-xs text-slate-500">
                    ({item.persentase.toFixed(1)}%)
                  </span>
                </span>
              </div>
              <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${Math.max(item.persentase, 1)}%`,
                    backgroundColor: item.warna,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* GRAFIK LINGKARAN (DONUT) */
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-2">
          <div className="relative w-48 h-48 shrink-0">
            <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
              {/* Lingkaran dasar / background ring */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke="#F1F5F9"
                strokeWidth="24"
              />
              {/* Busur warna per-paslon & abstain */}
              {chartData.map((item) => {
                const strokeDasharray = `${(item.persentase / 100) * keliling} ${keliling}`;
                const strokeDashoffset = -((akumulasiPersen / 100) * keliling);
                akumulasiPersen += item.persentase;

                return (
                  <circle
                    key={item.id}
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="transparent"
                    stroke={item.warna}
                    strokeWidth="24"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-700 ease-out"
                  />
                );
              })}
            </svg>
            {/* Label di tengah donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-xl font-black text-slate-800">
                {totalSuara}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                Suara
              </span>
            </div>
          </div>

          {/* Legenda Warna & Angka */}
          <div className="flex-1 w-full space-y-2.5">
            {chartData.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-xs sm:text-sm bg-slate-50/80 hover:bg-slate-100/80 p-2.5 rounded-lg border border-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 mr-2">
                  <span
                    className="w-3.5 h-3.5 rounded-md shrink-0"
                    style={{ backgroundColor: item.warna }}
                  />
                  <span className="font-medium text-slate-700 truncate">
                    {item.label}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-bold text-slate-900">
                    {item.jumlah}
                  </span>
                  <span className="text-xs text-slate-500 ml-1">
                    ({item.persentase.toFixed(1)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

