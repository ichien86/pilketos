import "./load-env";
import { getDb } from "../src/lib/db";
import { ensureIndexes } from "../src/lib/indexes";
import { ensureChecklistSeeded } from "../src/lib/checklist";
import { URUTAN_FASE, type KontrolFase } from "../src/types";
import { newId } from "../src/lib/id";

async function main() {
  const db = await getDb("prod");
  await ensureIndexes(db);
  await ensureChecklistSeeded(db);

  const existing = await db.collection<KontrolFase>("kontrol_fase").find({}).toArray();
  const existingNama = new Set(existing.map((f) => f.nama_fase));
  const toInsert: KontrolFase[] = URUTAN_FASE.filter((nama) => !existingNama.has(nama)).map((nama) => ({
    _id: newId(),
    nama_fase: nama,
    status: "belum_dibuka",
    dibuka_at: null,
    ditutup_at: null,
    kandidat_terkunci: null,
  }));
  if (toInsert.length > 0) {
    await db.collection<KontrolFase>("kontrol_fase").insertMany(toInsert);
  }

  console.log("Setup selesai: index + checklist Go/No-Go + 5 dokumen fase (pendataan..pemilihan) siap.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
