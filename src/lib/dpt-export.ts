import ExcelJS from "exceljs";

export interface DptExportItem {
  nis_nip: string;
  nama: string;
}

export interface DptRowData {
  no: number;
  nis_nip: string;
  nama: string;
}

export interface DptExportMetadata {
  judul: string;
  filenameBase: string;
  subjudul: string;
}

/**
 * Membentuk judul resmi dan nama file bersih berdasarkan kombinasi filter status dan kelas.
 */
export function getDptExportMetadata(
  filterStatus: string,
  filterKelas: string,
  cari?: string
): DptExportMetadata {
  const statusMap: Record<string, { judul: string; file: string }> = {
    belum_sosialisasi: { judul: "BELUM SOSIALISASI", file: "Belum_Sosialisasi" },
    belum_aktivasi: { judul: "BELUM AKTIVASI", file: "Belum_Aktivasi" },
    sudah_memilih: { judul: "SUDAH MEMILIH", file: "Sudah_Memilih" },
    belum_memilih: { judul: "BELUM MEMILIH", file: "Belum_Memilih" },
  };

  const statusInfo = statusMap[filterStatus];

  let kelasJudul = "";
  let kelasFile = "";
  if (filterKelas) {
    if (filterKelas === "__guru__") {
      kelasJudul = "GURU";
      kelasFile = "Guru";
    } else {
      kelasJudul = `KELAS ${filterKelas.toUpperCase()}`;
      kelasFile = `Kelas_${filterKelas.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    }
  }

  let judul: string;
  let filenameBase: string;

  if (!statusInfo && !kelasJudul) {
    judul = "DATA PEMILIH TETAP (DPT)";
    filenameBase = "DPT";
  } else {
    const judulParts = ["DPT"];
    const fileParts = ["DPT"];
    if (statusInfo) {
      judulParts.push(statusInfo.judul);
      fileParts.push(statusInfo.file);
    }
    if (kelasJudul) {
      judulParts.push(kelasJudul);
      fileParts.push(kelasFile);
    }
    judul = judulParts.join(" - ");
    filenameBase = fileParts.join("_");
  }

  const tanggalStr = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  const infoPencarian = cari && cari.trim() ? ` | Filter Pencarian: "${cari.trim()}"` : "";
  const subjudul = `Dicetak pada: ${tanggalStr} WIB${infoPencarian}`;

  return { judul, filenameBase, subjudul };
}

/**
 * Format data mentah DPT menjadi baris tabel ekspor berisi No, NIS/NIP, dan Nama saja.
 */
export function formatDptExportData(items: DptExportItem[]): DptRowData[] {
  return items.map((item, index) => ({
    no: index + 1,
    nis_nip: String(item.nis_nip ?? "").trim(),
    nama: String(item.nama ?? "").trim(),
  }));
}

/**
 * Download blob ke file di browser.
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Membuat Workbook ExcelJS untuk DPT dengan format header, subjudul, dan styling kolom.
 */
export async function createDptExcelWorkbook(
  items: DptExportItem[],
  filterStatus: string,
  filterKelas: string,
  cari?: string
): Promise<{ workbook: ExcelJS.Workbook; meta: DptExportMetadata }> {
  const meta = getDptExportMetadata(filterStatus, filterKelas, cari);
  const data = formatDptExportData(items);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Pilketos";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("DPT", {
    pageSetup: { paperSize: 9, orientation: "portrait" }, // A4
  });

  // Judul di baris 1
  worksheet.mergeCells("A1:C1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = meta.judul;
  titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF0F172A" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 26;

  // Subjudul di baris 2 (Info Tanggal & Total)
  worksheet.mergeCells("A2:C2");
  const subCell = worksheet.getCell("A2");
  subCell.value = `Total Data: ${data.length} Pemilih | ${meta.subjudul}`;
  subCell.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(2).height = 18;

  // Baris kosong di baris 3
  worksheet.getRow(3).height = 10;

  // Header tabel di baris 4
  const headerRow = worksheet.getRow(4);
  headerRow.height = 24;
  headerRow.values = ["No", "NIS / NIP", "Nama"];

  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" }, // dark slate
    };
    cell.alignment = {
      horizontal: colNumber === 3 ? "left" : "center",
      vertical: "middle",
    };
    cell.border = {
      top: { style: "medium", color: { argb: "FF0F172A" } },
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
      left: { style: "thin", color: { argb: "FF334155" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });

  // Isi data
  data.forEach((row, i) => {
    const r = worksheet.addRow([row.no, row.nis_nip, row.nama]);
    r.height = 20;

    const isEven = i % 2 === 1;
    const bgArgb = isEven ? "FFF8FAFC" : "FFFFFFFF";

    r.eachCell((cell, colNumber) => {
      cell.font = { name: "Arial", size: 10, color: { argb: "FF1E293B" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: bgArgb },
      };
      cell.alignment = {
        horizontal: colNumber === 3 ? "left" : "center",
        vertical: "middle",
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };

      // Pastikan NIS / NIP disimpan sebagai teks murni (agar tidak kehilangan leading zero)
      if (colNumber === 2) {
        cell.numFmt = "@";
      }
    });
  });

  // Atur lebar kolom
  worksheet.getColumn(1).width = 8;
  worksheet.getColumn(2).width = 24;
  worksheet.getColumn(3).width = 42;

  return { workbook, meta };
}

/**
 * Ekspor data DPT ke Excel (.xlsx) dengan judul dinamis dan kolom No, NIS/NIP, Nama saja.
 */
export async function exportDptToExcel(
  items: DptExportItem[],
  filterStatus: string,
  filterKelas: string,
  cari?: string
): Promise<void> {
  const { workbook, meta } = await createDptExcelWorkbook(items, filterStatus, filterKelas, cari);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, `${meta.filenameBase}.xlsx`);
}

/**
 * Ekspor data DPT ke PDF (.pdf) dengan jsPDF & jspdf-autotable.
 */
export async function exportDptToPdf(
  items: DptExportItem[],
  filterStatus: string,
  filterKelas: string,
  cari?: string
): Promise<void> {
  const meta = getDptExportMetadata(filterStatus, filterKelas, cari);
  const data = formatDptExportData(items);

  const { jsPDF } = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Dokumen
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(meta.judul, pageWidth / 2, 16, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Total Data: ${data.length} Pemilih | ${meta.subjudul}`, pageWidth / 2, 22, {
    align: "center",
  });

  // Garis dekoratif
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.5);
  doc.line(14, 25, pageWidth - 14, 25);

  const tableBody = data.map((r) => [r.no, r.nis_nip, r.nama]);

  // Render tabel
  autoTable(doc, {
    startY: 28,
    head: [["No", "NIS / NIP", "Nama"]],
    body: tableBody,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9.5,
      halign: "center",
      valign: "middle",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 14 },
      1: { halign: "center", cellWidth: 38 },
      2: { halign: "left" },
    },
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      valign: "middle",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    margin: { left: 14, right: 14, top: 28, bottom: 18 },
    didDrawPage: (hookData) => {
      // Footer: Halaman X dari Y
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        `Halaman ${hookData.pageNumber} dari ${pageCount}`,
        pageWidth - 14,
        doc.internal.pageSize.getHeight() - 10,
        { align: "right" }
      );
      doc.text(
        "Pilketos - Sistem Pemilihan Ketua OSIS",
        14,
        doc.internal.pageSize.getHeight() - 10,
        { align: "left" }
      );
    },
  });

  doc.save(`${meta.filenameBase}.pdf`);
}
