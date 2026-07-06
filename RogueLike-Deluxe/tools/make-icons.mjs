// Génère les icônes de l'app (PNG, ICO, ICNS) sans aucune dépendance.
import { writeFileSync, mkdirSync } from "fs";
import { deflateSync } from "zlib";

// ---------- encodeur PNG minimal ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(rgba, w, h) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filtre none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- pixel art 16x16 : épée légendaire sur sceau ----------
const ART = [
  "bbbbbbbbbbbbbbbb",
  "bbbccbbbbbbccbbb",
  "bbcbbcbwwbcbbcbb",
  "bbbbbbbwWbbbbbbb",
  "bbcbbbwWbbbbcbbb",
  "bbcbbwWbbbbbcbbb",
  "bbbbwWbbbbbbbbbb",
  "bbbwWbbbbbbcbbbb",
  "bbgbbbbbbbbbbbbb",
  "bggwbbbbbbbcbbbb",
  "bgbgbbbbbbbbbbbb",
  "bhhbbbbcbbbbcbbb",
  "bbbbccbbbbccbbbb",
  "bbbbbbcccbbbbbbb",
  "bbbbbbbbbbbbbbbb",
  "bbbbbbbbbbbbbbbb",
];
const PAL = {
  b: [12, 9, 20, 255],      // fond sombre
  c: [90, 223, 232, 255],   // runes cyan
  w: [224, 177, 62, 255],   // lame or
  W: [255, 233, 168, 255],  // reflet
  g: [138, 95, 208, 255],   // garde violette
  h: [74, 47, 128, 255],    // pommeau
};
function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const s = size / 16;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const c = PAL[ART[Math.floor(y / s)][Math.floor(x / s)]] ?? PAL.b;
      const i = (y * size + x) * 4;
      rgba[i] = c[0]; rgba[i + 1] = c[1]; rgba[i + 2] = c[2]; rgba[i + 3] = c[3];
    }
  return rgba;
}

mkdirSync("src-tauri/icons", { recursive: true });
const png = (size) => encodePng(render(size), size, size);

writeFileSync("src-tauri/icons/32x32.png", png(32));
writeFileSync("src-tauri/icons/128x128.png", png(128));
writeFileSync("src-tauri/icons/128x128@2x.png", png(256));
writeFileSync("src-tauri/icons/icon.png", png(512));

// ICO (format PNG embarqué, Vista+)
const png256 = png(256);
const icoHeader = Buffer.alloc(6 + 16);
icoHeader.writeUInt16LE(0, 0);   // réservé
icoHeader.writeUInt16LE(1, 2);   // type icône
icoHeader.writeUInt16LE(1, 4);   // 1 image
icoHeader[6] = 0;  // 0 = 256px
icoHeader[7] = 0;
icoHeader[8] = 0; icoHeader[9] = 0;
icoHeader.writeUInt16LE(1, 10);  // plans
icoHeader.writeUInt16LE(32, 12); // bpp
icoHeader.writeUInt32LE(png256.length, 14);
icoHeader.writeUInt32LE(22, 18); // offset
writeFileSync("src-tauri/icons/icon.ico", Buffer.concat([icoHeader, png256]));

// ICNS (entrée ic09 = PNG 512)
const png512 = png(512);
const entry = Buffer.concat([Buffer.from("ic09", "ascii"), (() => { const b = Buffer.alloc(4); b.writeUInt32BE(png512.length + 8); return b; })(), png512]);
const icns = Buffer.concat([Buffer.from("icns", "ascii"), (() => { const b = Buffer.alloc(4); b.writeUInt32BE(entry.length + 8); return b; })(), entry]);
writeFileSync("src-tauri/icons/icon.icns", icns);

console.log("icônes générées");
