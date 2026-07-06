// Bundle le jeu en un seul fichier dist/index.html (jouable partout, embarquable Tauri)
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const res = await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  write: false,
});

const js = res.outputFiles[0].text;
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
<script>${js.replace(/<\/script>/g, "<\\/script>")}</script>
</body>
</html>`;

mkdirSync("dist", { recursive: true });
writeFileSync("dist/index.html", html);
console.log(`dist/index.html : ${(html.length / 1024).toFixed(1)} Ko`);
