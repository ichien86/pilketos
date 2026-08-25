import "./load-env";
import { getDb } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { newId } from "../src/lib/id";
import type { AkunPengguna } from "../src/types";

// Bikin/reset akun admin pertama -- tidak ada jalur self-service untuk ini
// (sengaja, admin bukan peran yang boleh dibuat sendiri lewat form publik).
// Pakai: npm run create-admin -- <username> <password>
async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.error("Pakai: npm run create-admin -- <username> <password>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password minimal 8 karakter");
    process.exit(1);
  }

  const db = await getDb("prod");
  const existing = await db.collection<AkunPengguna>("akun_pengguna").findOne({ username });
  if (existing) {
    if (existing.role !== "admin") {
      console.error(`Username "${username}" sudah dipakai akun dengan role "${existing.role}" -- pilih username lain`);
      process.exit(1);
    }
    await db.collection<AkunPengguna>("akun_pengguna").updateOne(
      { _id: existing._id },
      { $set: { password_hash: await hashPassword(password), wajib_ganti_password: false, aktivasi_selesai: true } }
    );
    console.log(`Password akun admin "${username}" sudah direset.`);
    process.exit(0);
  }

  const doc: AkunPengguna = {
    _id: newId(),
    pemilih_id: null,
    kandidat_id: null,
    username,
    password_hash: await hashPassword(password),
    role: "admin",
    aktivasi_selesai: true,
    wajib_ganti_password: false,
    created_at: new Date(),
  };
  await db.collection<AkunPengguna>("akun_pengguna").insertOne(doc);
  console.log(`Akun admin "${username}" dibuat.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
