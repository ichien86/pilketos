import LogoutButton from "@/components/LogoutButton";

// Beranda panitia pemilihan -- mengelola data DPT/kandidat/bilik (persiapan)
// + alat hari-H (check-in, pantauan bilik, scan keluar). Admin sengaja tidak
// lagi menonjolkan menu-menu ini di /admin/fase supaya fokus ke kontrol
// fase & manajemen akun panitia/pengawas saja.
export default function PanitiaHomePage() {
  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto space-y-6">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-bold">Panel Panitia Pemilihan</h1>
        <LogoutButton />
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Persiapan</h2>
        <div className="bg-white rounded-xl shadow divide-y">
          <NavItem href="/admin/dpt" label="Data Pemilih Tetap (DPT)" desc="Import Excel, tambah/edit/hapus pemilih, reset password" />
          <NavItem href="/admin/kandidat" label="Kandidat" desc="Daftar paslon, foto, publish/batalkan, akun paslon" />
          <NavItem href="/admin/bilik" label="Bilik" desc="Konfigurasi jumlah bilik & cetak QR" />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Hari-H / Simulasi</h2>
        <div className="bg-white rounded-xl shadow divide-y">
          <NavItem href="/panitia/checkin" label="Check-in Pemilih" desc="Scan identitas & ACC masuk bilik" />
          <NavItem href="/panitia/bilik-monitor" label="Pantauan Bilik" desc="Status kosong/terisi real-time" />
          <NavItem href="/panitia/exit-scan" label="Scan Keluar" desc="Validasi barcode bukti sudah memilih" />
          <NavItem href="/admin/rekonsiliasi" label="Rekonsiliasi" desc="Rekap agregat token, suara, dan status" />
        </div>
      </section>
    </main>
  );
}

function NavItem({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <a href={href} className="block p-4 hover:bg-slate-50">
      <p className="font-medium">{label}</p>
      <p className="text-xs text-slate-400">{desc}</p>
    </a>
  );
}
