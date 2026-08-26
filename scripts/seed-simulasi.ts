import "./load-env";
import { aktifkanUjiCoba } from "../src/lib/mode";

// Nyalakan mode uji coba secara manual di luar UI (mis. debugging lokal) --
// menyiapkan database sandbox kosong (kelima fase "belum_dibuka", checklist
// kosong), sama persis seperti admin menekan "Aktifkan Mode Uji Coba".
aktifkanUjiCoba()
  .then(() => {
    console.log("Mode uji coba aktif -- database sandbox siap dari nol.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
