import ExcelJS from "exceljs";

export interface BarisDptValid {
  jenis: "siswa" | "guru";
  nis_nip: string;
  nama: string;
  kelas: string | null;
  pangkat: string | null;
  tanggal_lahir: string; // dinormalisasi ke YYYY-MM-DD
}

export interface BarisDptError {
  jenis: "siswa" | "guru";
  baris: number;
  pesan: string;
}

export interface HasilParseDpt {
  valid: BarisDptValid[];
  error: BarisDptError[];
}

// Nama bulan Indonesia (lengkap & singkatan umum) + Inggris, supaya panitia
// yang mengetik manual "17 Agustus 2008" atau "17 Aug 2008" tidak tertolak
// hanya karena tidak memakai format angka.
const NAMA_BULAN: Record<string, number> = {
  januari: 1, jan: 1, january: 1,
  februari: 2, feb: 2, february: 2,
  maret: 3, mar: 3, march: 3,
  april: 4, apr: 4,
  mei: 5, may: 5,
  juni: 6, jun: 6, june: 6,
  juli: 7, jul: 7, july: 7,
  agustus: 8, agu: 8, agt: 8, aug: 8, august: 8,
  september: 9, sep: 9, sept: 9,
  oktober: 10, okt: 10, oct: 10, october: 10,
  november: 11, nov: 11,
  desember: 12, des: 12, dec: 12, december: 12,
};

function tanggalValid(y: number, mo: number, d: number): boolean {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  // new Date "menormalkan" tanggal yang meluap (mis. 31 Februari -> Maret) --
  // dicek balik ke komponennya supaya tanggal seperti itu ditolak, bukan digeser diam-diam.
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function formatIso(y: number, mo: number, d: number): string {
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function normalisasiTanggal(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  // YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, y, mo, d] = isoMatch;
    const yn = Number(y), mon = Number(mo), dn = Number(d);
    return tanggalValid(yn, mon, dn) ? formatIso(yn, mon, dn) : null;
  }

  // DD/MM/YYYY, DD-MM-YYYY, atau DD.MM.YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (dmyMatch) {
    const [, d, mo, y] = dmyMatch;
    const yn = Number(y), mon = Number(mo), dn = Number(d);
    return tanggalValid(yn, mon, dn) ? formatIso(yn, mon, dn) : null;
  }

  // DD <Nama Bulan> YYYY, mis. "17 Agustus 2008" atau "17 Aug 2008"
  const namaBulanMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/);
  if (namaBulanMatch) {
    const [, d, bulanRaw, y] = namaBulanMatch;
    const mon = NAMA_BULAN[bulanRaw.toLowerCase()];
    if (!mon) return null;
    const yn = Number(y), dn = Number(d);
    return tanggalValid(yn, mon, dn) ? formatIso(yn, mon, dn) : null;
  }

  return null;
}

function cellText(cell: ExcelJS.Cell | undefined): string {
  if (!cell || cell.value == null) return "";
  const v = cell.value;
  if (typeof v === "object" && v !== null && "text" in v) {
    return String((v as { text: unknown }).text).trim();
  }
  return String(v).trim();
}

function parseSheet(
  sheet: ExcelJS.Worksheet | undefined,
  jenis: "siswa" | "guru",
  seenInFile: Set<string>
): { valid: BarisDptValid[]; error: BarisDptError[] } {
  const valid: BarisDptValid[] = [];
  const error: BarisDptError[] = [];
  if (!sheet) return { valid, error };

  const header = sheet.getRow(1).values as unknown[];
  const colIndex = (name: string): number => {
    for (let i = 1; i < header.length; i++) {
      if (String(header[i] ?? "").trim().toLowerCase() === name.toLowerCase()) return i;
    }
    return -1;
  };

  const idCol = colIndex(jenis === "siswa" ? "NIS" : "NIP");
  const namaCol = colIndex("Nama");
  const kelasPangkatCol = colIndex(jenis === "siswa" ? "Kelas" : "Pangkat");
  const tglCol = colIndex("Tanggal Lahir");

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const isEmpty = row.values == null || (row.values as unknown[]).every((v) => v == null || v === "");
    if (isEmpty) return;

    const id = idCol > 0 ? cellText(row.getCell(idCol)) : "";
    const nama = namaCol > 0 ? cellText(row.getCell(namaCol)) : "";
    const kelasPangkat = kelasPangkatCol > 0 ? cellText(row.getCell(kelasPangkatCol)) : "";
    const tglRaw = tglCol > 0 ? row.getCell(tglCol).value : null;
    const tanggalLahir = normalisasiTanggal(tglRaw);

    if (!id || !nama || !kelasPangkat || !tanggalLahir) {
      error.push({
        jenis,
        baris: rowNumber,
        pesan: "Kolom wajib kosong atau format tanggal lahir tidak valid",
      });
      return;
    }
    const key = `${jenis}:${id}`;
    if (seenInFile.has(key)) {
      error.push({ jenis, baris: rowNumber, pesan: `Nomor identitas duplikat di dalam file: ${id}` });
      return;
    }
    seenInFile.add(key);

    valid.push({
      jenis,
      nis_nip: id,
      nama,
      kelas: jenis === "siswa" ? kelasPangkat : null,
      pangkat: jenis === "guru" ? kelasPangkat : null,
      tanggal_lahir: tanggalLahir,
    });
  });

  return { valid, error };
}

export async function parseDptExcel(buffer: Buffer): Promise<HasilParseDpt> {
  const workbook = new ExcelJS.Workbook();
  // exceljs membundel deklarasi tipe Buffer sendiri yang tidak identik dengan
  // @types/node -- bukan ketidakcocokan data sungguhan, hanya deklarasi tipe.
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const seenInFile = new Set<string>();
  const siswa = parseSheet(workbook.getWorksheet("Siswa"), "siswa", seenInFile);
  const guru = parseSheet(workbook.getWorksheet("Guru"), "guru", seenInFile);

  return {
    valid: [...siswa.valid, ...guru.valid],
    error: [...siswa.error, ...guru.error],
  };
}
