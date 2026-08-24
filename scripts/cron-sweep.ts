import "./load-env";
import cron from "node-cron";
import { getDb } from "../src/lib/db";
import { sweepExpiredSesi } from "../src/lib/ttl";
import { resolveHariHMode, FaseGateError } from "../src/lib/fase-gate";

// Keputusan desain #2 -- proses terpisah, jalan tiap N detik, sebagai
// pelengkap lazy-check yang sudah ada di tiap endpoint. Jalankan dengan:
//   npm run cron
const intervalSeconds = Number(process.env.CRON_SWEEP_INTERVAL_SECONDS ?? 30);
const cronExpr = `*/${Math.max(5, intervalSeconds)} * * * * *`;

async function tick() {
  try {
    const mode = await resolveHariHMode();
    const db = await getDb(mode);
    const count = await sweepExpiredSesi(db);
    if (count > 0) {
      console.log(`[cron-sweep] ${new Date().toISOString()} mode=${mode} sesi kedaluwarsa disapu: ${count}`);
    }
  } catch (e) {
    if (e instanceof FaseGateError) return; // tidak ada fase hari-H aktif, tidak ada yang perlu disapu
    console.error("[cron-sweep] gagal:", e);
  }
}

console.log(`[cron-sweep] berjalan tiap ${intervalSeconds} detik...`);
cron.schedule(cronExpr, tick);
tick();
