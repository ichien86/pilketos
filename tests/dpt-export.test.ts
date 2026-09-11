import { describe, it, expect } from "vitest";
import { getDptExportMetadata, formatDptExportData, createDptExcelWorkbook } from "../src/lib/dpt-export";

describe("dpt-export metadata & naming helper", () => {
  it("menghasilkan judul DPT default jika tidak ada filter", () => {
    const meta = getDptExportMetadata("semua", "");
    expect(meta.judul).toBe("DATA PEMILIH TETAP (DPT)");
    expect(meta.filenameBase).toBe("DPT");
  });

  it("menghasilkan judul sesuai filter belum sosialisasi", () => {
    const meta = getDptExportMetadata("belum_sosialisasi", "");
    expect(meta.judul).toBe("DPT - BELUM SOSIALISASI");
    expect(meta.filenameBase).toBe("DPT_Belum_Sosialisasi");
  });

  it("menghasilkan judul sesuai filter belum aktivasi", () => {
    const meta = getDptExportMetadata("belum_aktivasi", "");
    expect(meta.judul).toBe("DPT - BELUM AKTIVASI");
    expect(meta.filenameBase).toBe("DPT_Belum_Aktivasi");
  });

  it("menghasilkan judul sesuai filter sudah memilih dan belum memilih", () => {
    const sudah = getDptExportMetadata("sudah_memilih", "");
    expect(sudah.judul).toBe("DPT - SUDAH MEMILIH");
    expect(sudah.filenameBase).toBe("DPT_Sudah_Memilih");

    const belum = getDptExportMetadata("belum_memilih", "");
    expect(belum.judul).toBe("DPT - BELUM MEMILIH");
    expect(belum.filenameBase).toBe("DPT_Belum_Memilih");
  });

  it("menghasilkan judul jika hanya filter kelas yang dipilih", () => {
    const metaKelas = getDptExportMetadata("semua", "X-A");
    expect(metaKelas.judul).toBe("DPT - KELAS X-A");
    expect(metaKelas.filenameBase).toBe("DPT_Kelas_X-A");

    const metaGuru = getDptExportMetadata("semua", "__guru__");
    expect(metaGuru.judul).toBe("DPT - GURU");
    expect(metaGuru.filenameBase).toBe("DPT_Guru");
  });

  it("menghasilkan judul gabungan jika ada filter status dan filter kelas", () => {
    const meta1 = getDptExportMetadata("belum_sosialisasi", "X-A");
    expect(meta1.judul).toBe("DPT - BELUM SOSIALISASI - KELAS X-A");
    expect(meta1.filenameBase).toBe("DPT_Belum_Sosialisasi_Kelas_X-A");

    const meta2 = getDptExportMetadata("belum_aktivasi", "__guru__");
    expect(meta2.judul).toBe("DPT - BELUM AKTIVASI - GURU");
    expect(meta2.filenameBase).toBe("DPT_Belum_Aktivasi_Guru");

    const meta3 = getDptExportMetadata("belum_memilih", "XII-IPA-1");
    expect(meta3.judul).toBe("DPT - BELUM MEMILIH - KELAS XII-IPA-1");
    expect(meta3.filenameBase).toBe("DPT_Belum_Memilih_Kelas_XII-IPA-1");
  });

  it("hanya menyertakan kolom No, NIS/NIP, dan Nama", () => {
    const rawList = [
      {
        _id: "1",
        jenis: "siswa" as const,
        nis_nip: "12345",
        nama: "Ahmad Siswa",
        kelas: "X-A",
        pangkat: null,
        tanggal_lahir: "2008-01-01",
        aktivasi_selesai: true,
        sosialisasi_ditonton: 2,
        sosialisasi_wajib: 2,
        memenuhi_syarat: true,
        sudah_memilih: false,
      },
      {
        _id: "2",
        jenis: "guru" as const,
        nis_nip: "198001012005011001",
        nama: "Budi Guru",
        kelas: null,
        pangkat: "Pembina",
        tanggal_lahir: "1980-01-01",
        aktivasi_selesai: false,
        sosialisasi_ditonton: 0,
        sosialisasi_wajib: 2,
        memenuhi_syarat: false,
        sudah_memilih: false,
      },
    ];

    const formatted = formatDptExportData(rawList);
    expect(formatted).toHaveLength(2);
    expect(formatted[0]).toEqual({
      no: 1,
      nis_nip: "12345",
      nama: "Ahmad Siswa",
    });
    expect(formatted[1]).toEqual({
      no: 2,
      nis_nip: "198001012005011001",
      nama: "Budi Guru",
    });

    // Pastikan field lain tidak bocor ke hasil ekspor
    expect((formatted[0] as unknown as Record<string, unknown>).tanggal_lahir).toBeUndefined();
    expect((formatted[0] as unknown as Record<string, unknown>).kelas).toBeUndefined();
    expect((formatted[0] as unknown as Record<string, unknown>).pangkat).toBeUndefined();
  });

  it("membuat workbook Excel dengan header dan baris yang valid", async () => {
    const rawList = [
      { nis_nip: "00123", nama: "Siswa 1" },
      { nis_nip: "00124", nama: "Siswa 2" },
    ];
    const { workbook, meta } = await createDptExcelWorkbook(rawList, "belum_sosialisasi", "X-A");
    expect(meta.judul).toBe("DPT - BELUM SOSIALISASI - KELAS X-A");
    const ws = workbook.getWorksheet("DPT");
    expect(ws).toBeDefined();

    // Judul di A1
    expect(ws?.getCell("A1").value).toBe("DPT - BELUM SOSIALISASI - KELAS X-A");

    // Header di baris 4
    expect(ws?.getCell("A4").value).toBe("No");
    expect(ws?.getCell("B4").value).toBe("NIS / NIP");
    expect(ws?.getCell("C4").value).toBe("Nama");

    // Data di baris 5 dan 6
    expect(ws?.getCell("A5").value).toBe(1);
    expect(ws?.getCell("B5").value).toBe("00123");
    expect(ws?.getCell("C5").value).toBe("Siswa 1");

    expect(ws?.getCell("A6").value).toBe(2);
    expect(ws?.getCell("B6").value).toBe("00124");
    expect(ws?.getCell("C6").value).toBe("Siswa 2");

    // Pastikan kolom D kosong (tidak ada kolom selain No, NIS/NIP, Nama)
    expect(ws?.getCell("D4").value).toBeNull();
    expect(ws?.getCell("D5").value).toBeNull();
  });
});

