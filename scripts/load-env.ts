import { config } from "dotenv";
import path from "path";
import { existsSync } from "fs";

// Script CLI (bukan proses Next.js) tidak otomatis membaca .env.local seperti
// Next -- muat manual di sini, .env.local didahulukan kalau ada.
const root = path.resolve(__dirname, "..");
const local = path.join(root, ".env.local");
config({ path: existsSync(local) ? local : path.join(root, ".env") });
