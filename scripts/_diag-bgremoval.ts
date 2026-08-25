import { processAndSavePhoto } from "../src/lib/photo";
import sharp from "sharp";

const svg = `<svg width="600" height="800" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#f2f2f2"/>
  <ellipse cx="300" cy="280" rx="140" ry="170" fill="#e0ac69"/>
  <rect x="180" y="460" width="240" height="300" fill="#2255aa"/>
</svg>`;

async function main() {
  const buf = await sharp(Buffer.from(svg)).jpeg().toBuffer();
  const file = new File([buf], "test.jpg", { type: "image/jpeg" });
  const url = await processAndSavePhoto(file);
  console.log("SAVED_URL:", url);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
