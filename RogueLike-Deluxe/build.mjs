// Bundle le jeu en un seul fichier dist/index.html (jouable partout, embarquable Tauri)
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const res = await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  write: false,
});

const js = res.outputFiles[0].text;

// ===== Musiques : MP3 de assets/audio/ embarqués en base64 (le jeu reste un seul fichier) =====
const AUDIO_DIR = "assets/audio";
let musicScript = "";
if (existsSync(AUDIO_DIR)) {
  const music = {};
  let total = 0;
  for (const f of readdirSync(AUDIO_DIR)) {
    if (!f.endsWith(".mp3")) continue;
    const key = f.replace(/\.mp3$/, "");
    const bytes = readFileSync(join(AUDIO_DIR, f));
    total += bytes.length;
    music[key] = `data:audio/mpeg;base64,${bytes.toString("base64")}`;
    console.log(`  ♪ ${f} (${(bytes.length / 1024 / 1024).toFixed(1)} Mo)`);
  }
  if (Object.keys(music).length > 0) {
    musicScript = `<script>window.__MUSIC__=${JSON.stringify(music)};</script>\n`;
    console.log(`  musiques embarquées : ${(total / 1024 / 1024).toFixed(1)} Mo`);
  }
}
const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>Les Sceaux de l'Abîme</title>
<style>
  html,body{margin:0;padding:0;height:100%;background:#07060a;overflow:hidden}
  #game{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
        image-rendering:pixelated;image-rendering:crisp-edges;outline:none}
  ::selection{background:transparent}
</style>
</head>
<body>
<canvas id="game" width="960" height="540" tabindex="0"></canvas>
${musicScript}<script>${js.replace(/<\/script>/g, "<\\/script>")}</script>
</body>
</html>`;

mkdirSync("dist", { recursive: true });
writeFileSync("dist/index.html", html);
console.log(`dist/index.html : ${(html.length / 1024).toFixed(1)} Ko`);
