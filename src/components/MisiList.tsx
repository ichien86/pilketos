import { splitMisi } from "@/lib/format";

// Tiap baris misi (dipisah Enter saat input admin) ditampilkan bernomor.
export default function MisiList({ misi, className }: { misi: string | null; className?: string }) {
  const poin = splitMisi(misi);
  if (poin.length === 0) return null;

  return (
    <ol className={`list-decimal list-inside space-y-1 ${className ?? ""}`}>
      {poin.map((p, i) => (
        <li key={i}>{p}</li>
      ))}
    </ol>
  );
}
