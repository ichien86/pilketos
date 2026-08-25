import sharp from "sharp";
import { removeBackground } from "@imgly/background-removal-node";

const svg = `<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  <ellipse cx="150" cy="140" rx="70" ry="85" fill="#e0ac69"/>
</svg>`;

console.log("mem before:", process.memoryUsage());

const buf = await sharp(Buffer.from(svg)).png().toBuffer();
console.log("input ok, size", buf.length);

const blob = new Blob([buf], { type: "image/png" });
const start = Date.now();
const result = await removeBackground(blob, { model: "small" });
console.log("removeBackground OK in", Date.now() - start, "ms");

const outBuf = Buffer.from(await result.arrayBuffer());
const meta = await sharp(outBuf).metadata();
console.log("output meta:", JSON.stringify(meta));
console.log("mem after:", process.memoryUsage());
process.exit(0);
