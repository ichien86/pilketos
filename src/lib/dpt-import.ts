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

function normalisasiTanggal(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    // Terima YYYY-MM-DD atau DD/MM/YYYY
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    if (iso.test(trimmed)) return trimmed;
    const m = trimmed.match(dmy);
    if (m) {
      const [, d, mo, y] = m;
      return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
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
