import "./load-env";
import { getDb } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { newId } from "../src/lib/id";
import type { AkunPengguna, Peran } from "../src/types";

const ROLE_BOLEH: Peran[] = ["admin", "panitia", "pengawas"];

// Bikin/reset akun staf (admin/panitia/pengawas) -- tidak ada jalur
// self-service untuk peran ini (sengaja, beda dengan pemilih yang aktivasi
// sendiri dari DPT, dan kandidat yang akunnya dibuatkan panitia lewat UI).
// Pakai: npm run create-staff -- <peran> <username> <password>
async function main() {
  const [role, username, password] = process.argv.slice(2) as [Peran, string, string];
  if (!role || !username || !password) {
    console.error("Pakai: npm run create-staff -- <admin|panitia|pengawas> <username> <password>");
    process.exit(1);
  }
  if (!ROLE_BOLEH.includes(role)) {
    console.error(`Peran tidak dikenal: "${role}" -- pilih salah satu: ${ROLE_BOLEH.join(", ")}`);
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password minimal 8 karakter");
    process.exit(1);
  }

  const db = await getDb("prod");
  const existing = await db.collection<AkunPengguna>("akun_pengguna").findOne({ username });
  if (existing) {
    if (existing.role !== role) {
      console.error(`Username "${username}" sudah dipakai akun dengan peran "${existing.role}" -- pilih username lain`);
      process.exit(1);
    }
    await db.collection<AkunPengguna>("akun_pengguna").updateOne(
      { _id: existing._id },
      { $set: { password_hash: await hashPassword(password), wajib_ganti_password: false, aktivasi_selesai: true } }
    );
    console.log(`Password akun ${role} "${username}" sudah direset.`);
    process.exit(0);
  }

  const doc: AkunPengguna = {
    _id: newId(),
    pemilih_id: null,
    kandidat_id: null,
    username,
    password_hash: await hashPassword(password),
    role,
    aktivasi_selesai: true,
    wajib_ganti_password: false,
    created_at: new Date(),
  };
  await db.collection<AkunPengguna>("akun_pengguna").insertOne(doc);
  console.log(`Akun ${role} "${username}" dibuat.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
