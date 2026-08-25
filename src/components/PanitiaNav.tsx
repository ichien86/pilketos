import LogoutButton from "@/components/LogoutButton";

const ITEMS = [
  { href: "/panitia", label: "Panel" },
  { href: "/admin/dpt", label: "DPT" },
  { href: "/admin/kandidat", label: "Kandidat" },
  { href: "/admin/bilik", label: "Bilik" },
  { href: "/panitia/checkin", label: "Check-in" },
  { href: "/panitia/bilik-monitor", label: "Pantauan Bilik" },
  { href: "/panitia/exit-scan", label: "Scan Keluar" },
  { href: "/admin/rekonsiliasi", label: "Rekonsiliasi" },
] as const;

// Nav konsisten di semua halaman yang dipakai panitia pemilihan -- supaya
// bisa lompat ke tools lain tanpa harus balik ke /panitia setiap kali.
export default function PanitiaNav({ active }: { active: string }) {
  return (
    <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {ITEMS.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className={item.href === active ? "font-bold text-slate-900" : "text-blue-600 hover:underline"}
        >
          {item.label}
        </a>
      ))}
      <LogoutButton />
    </nav>
  );
}
