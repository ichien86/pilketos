import "./load-env";
import { seedSimulasi } from "../src/lib/simulasi";

// Seeding manual di luar alur "buka fase simulasi" (mis. untuk debugging lokal).
seedSimulasi()
  .then(() => {
    console.log("Database simulasi berhasil di-seed ulang.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
