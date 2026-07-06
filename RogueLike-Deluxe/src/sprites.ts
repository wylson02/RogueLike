// ===== Pixel art procédural : tous les sprites sont dessinés par code =====

const sprites: Record<string, HTMLCanvasElement> = {};

function mk(rows: string[], pal: Record<string, string>): HTMLCanvasElement {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === "." || ch === " ") continue;
      const col = pal[ch];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  return c;
}

export function getSprite(name: string): HTMLCanvasElement { return sprites[name]; }

export function initSprites() {
  const O = "#141021"; // contour

  // ================= HÉROS =================
  sprites["player"] = mk([
    "......rr........",
    ".....rrr........",
    "....OhhhhO......",
    "...OhhhhhhO.....",
    "...OhDDDDhO.....",
    "...OhhhhhhO.....",
    "..OaaaaaaaaO....",
    ".OwaALLALAawO...",
    ".OwaAAAAAAawO.s.",
    ".OwaALggLAawO.s.",
    "..OaAAAAAAaO.gs.",
    "...OaaaaaaO..Os.",
    "...OllOOllO.....",
    "...OllO.OllO....",
    "..ObbO...ObbO...",
    "................",
  ], {
    r: "#c23b3b", h: "#9ba8c2", D: "#232032", a: "#6b7a99", A: "#8b9ab8",
    L: "#a8b6d2", g: "#e0b13e", w: "#7c8aa8", l: "#3d4358", b: "#2b2f40",
    s: "#c8d2e8", O,
  });

  // ================= SLIME =================
  sprites["slime"] = mk([
    "................",
    "................",
    "................",
    ".....OOOOOO.....",
    "....OgggggGO....",
    "...OgWWggggGO...",
    "..OgWWgggggggO..",
    "..OggggggggggO..",
    ".OggeeggggeeggO.",
    ".OggeeggggeeggO.",
    ".OgggggmmggggGO.",
    ".OggggggggggggO.",
    "..OggggggggggO..",
    "...OOOOOOOOOO...",
    "................",
    "................",
  ], { g: "#54b357", G: "#3f8e46", W: "#b8e8b0", e: "#17311c", m: "#17311c", O });

  sprites["slime_2"] = mk([
    "................",
    "................",
    "................",
    "................",
    "................",
    "....OOOOOOOO....",
    "...OgWWgggggO...",
    "..OgWWggggggGO..",
    ".OggggggggggggO.",
    ".OgeeggggggeegO.",
    ".OgeeggggggeegO.",
    "OggggggmmgggggGO",
    "OggggggggggggggO",
    ".OOOOOOOOOOOOOO.",
    "................",
    "................",
  ], { g: "#54b357", G: "#3f8e46", W: "#b8e8b0", e: "#17311c", m: "#17311c", O });

  // ================= SLIME NOCTURNE =================
  const nightPal = { g: "#4b3f8f", G: "#352a66", W: "#8f7fd4", e: "#7ff0ff", m: "#0c0a1c", O };
  sprites["nightslime"] = mk([
    "................",
    "................",
    "................",
    ".....OOOOOO.....",
    "....OgggggGO....",
    "...OgWWggggGO...",
    "..OgWWgggggggO..",
    "..OggggggggggO..",
    ".OggeeggggeeggO.",
    ".OggeeggggeeggO.",
    ".OgggggmmggggGO.",
    ".OggggggggggggO.",
    "..OggggggggggO..",
    "...OOOOOOOOOO...",
    "................",
    "................",
  ], nightPal);
  sprites["nightslime_2"] = mk([
    "................",
    "................",
    "................",
    "................",
    "................",
    "....OOOOOOOO....",
    "...OgWWgggggO...",
    "..OgWWggggggGO..",
    ".OggggggggggggO.",
    ".OgeeggggggeegO.",
    ".OgeeggggggeegO.",
    "OggggggmmgggggGO",
    "OggggggggggggggO",
    ".OOOOOOOOOOOOOO.",
    "................",
    "................",
  ], nightPal);

  // ================= GOLEM =================
  sprites["golem"] = mk([
    "................",
    "...OOOOOOOO.....",
    "..OrrRRRRrrO....",
    "..OrReeeeRrO....",
    "..OrReffeRrO....",
    "..OrReeeeRrO....",
    ".OOrrRRRRrrOO...",
    "OrrRRRRRRRRrrO..",
    "OrRRcCCcRRRRrO..",
    "OrRRcCCcRRRRrO..",
    "OrrRRRRRRRRrrO..",
    ".OrrRRRRRRrrO...",
    "..OrrO..OrrO....",
    "..OrrO..OrrO....",
    ".OrrrO..OrrrO...",
    "................",
  ], {
    r: "#5c544a", R: "#8a7f72", e: "#2b2620", f: "#ff9d2e",
    c: "#ffb347", C: "#ff8c1a", O,
  });

  // ================= GARDIEN DES SCEAUX =================
  sprites["warden"] = mk([
    ".....OOOOOO.....",
    "....OppppppO....",
    "...OpPPPPPPpO...",
    "...OpPeePeePO...",
    "...OpPPPPPPpO...",
    "..OppmmmmmmppO..",
    ".OpPPPPPPPPPPpO.",
    ".OpPPgPPPPgPPpO.",
    "OppPPPPPPPPPPppO",
    "OpPPPgPPPPgPPPpO",
    "OpPPPPPPPPPPPPpO",
    "OppPPPPPPPPPPppO",
    ".OpPPPPPPPPPPpO.",
    ".OppppppppppppO.",
    "..OOOOOOOOOOOO..",
    "................",
  ], {
    p: "#4a2f80", P: "#6b46b8", e: "#7ff0ff", m: "#2c1d52", g: "#c9b6ff", O,
  });

  // ================= ROI DE L'ABÎME (24x24) =================
  sprites["boss"] = mk([
    "........................",
    "....c..c....c..c........",
    "....cc.cc..cc.cc........",
    "....ccccccccccccc.......",
    "....OhhhhhhhhhhhO.......",
    "...OhhHHHHHHHHhhhO......",
    "...OhHeeHHHHeeHhhO......",
    "...OhHeeHHHHeeHhhO......",
    "...OhhHHHHHHHHhhhO......",
    "...OhhhmmmmmmhhhhO......",
    "..OrrrrrrrrrrrrrrrO.....",
    ".OrrRRRRRRRRRRRRrrrO....",
    ".OrRRgRRRRRRRRgRRrrO..s.",
    "OrrRRRRRRRRRRRRRRrrrO.s.",
    "OrRRRgRRRRRRRRgRRRrrO.s.",
    "OrRRRRRRRRRRRRRRRRrrOgs.",
    "OrrRRRRRRRRRRRRRRrrrOOs.",
    ".OrRRRRRRRRRRRRRRrrO..s.",
    ".OrrRRRRRRRRRRRRrrrO....",
    "..OrrRRRRRRRRRRrrrO.....",
    "..OrrrrrrrrrrrrrrrO.....",
    "...OrrrO.....OrrrO......",
    "..OrrrO.......OrrrO.....",
    "........................",
  ], {
    c: "#e0b13e", h: "#3a3050", H: "#524670", e: "#ff3b3b", m: "#241d38",
    r: "#241d38", R: "#38294f", g: "#8a5fd0", s: "#b8c4e0", O,
  });

  // ================= MARCHAND =================
  sprites["merchant"] = mk([
    "................",
    "....OOOOOO......",
    "...OmmmmmmO.....",
    "..OmmMMMMmmO....",
    "..OmMffffMmO....",
    "..OmMfeefMmO....",
    "..OmMffffMmO....",
    "..OmmMMMMmmO....",
    ".OmmRRRRRRmmO...",
    ".OmRRgRRgRRmOp..",
    ".OmRRRRRRRRmpp..",
    ".OmRRRRRRRRmpP..",
    ".OmmRRRRRRmmOp..",
    "..OllO..OllO....",
    "..ObbO..ObbO....",
    "................",
  ], {
    m: "#7a5a30", M: "#b58a4e", f: "#d8a878", e: "#2b2018",
    R: "#8a6838", g: "#e0b13e", l: "#4a3820", b: "#2e2214",
    p: "#c8a05a", P: "#e0b13e", O,
  });

  // ================= PNJ =================
  const villager = (tunic: string, tunic2: string, hair: string) => mk([
    "................",
    ".....OOOO.......",
    "....OqqqqO......",
    "...OqqqqqqO.....",
    "...OffffffO.....",
    "...OfeffefO.....",
    "...OffffffO.....",
    "....OffffO......",
    "..OttTTTTttO....",
    ".OwtTTTTTTtwO...",
    ".OwtTTTTTTtwO...",
    ".OwtTTTTTTtwO...",
    "..OttTTTTttO....",
    "...OllOOllO.....",
    "...ObbO.ObbO....",
    "................",
  ], { q: hair, f: "#d8a878", e: "#2b2018", t: tunic, T: tunic2, w: "#c89868", l: "#3d3448", b: "#282234", O });

  sprites["pnj_kael"] = villager("#7a3c2e", "#a05540", "#4a3828");
  sprites["pnj_lysa"] = villager("#3c5a7a", "#5a80a8", "#c8a050");
  sprites["pnj_orin"] = villager("#4a6038", "#688850", "#787060");
  sprites["pnj_elya"] = villager("#6a3c6a", "#95589a", "#382828");
  sprites["pnj_vesna"] = villager("#8a6838", "#b58a4e", "#583c20");

  // Sentinelle (garde en armure avec lance)
  sprites["pnj_sentinelle"] = mk([
    "..l.............",
    "..l..OOOO.......",
    "..L.OhhhhO......",
    "..l.OhDDhhO.....",
    "..l.OhhhhhO.....",
    "..lOaaaaaaaO....",
    "..lOaAAAAAaO....",
    "..lwaAgAgAaw....",
    "..lwaAAAAAaw....",
    "..lOaAAAAAaO....",
    "..lOaaaaaaaO....",
    "..l.OllOllO.....",
    "..l.OllOllO.....",
    "..lObbO.ObbO....",
    "..l.............",
    "................",
  ], {
    h: "#8a94ac", D: "#232032", a: "#5c6880", A: "#7c88a2", g: "#e0b13e",
    w: "#6c7890", l: "#8a7448", L: "#c8c8d8", b: "#2b2f40", O,
  });

  // ================= COFFRES =================
  sprites["chest"] = mk([
    "................",
    "................",
    "................",
    "................",
    "...OOOOOOOOOO...",
    "..OwwwwwwwwwwO..",
    ".OwWWWWWWWWWWwO.",
    ".OwwwwgGgwwwwwO.",
    ".OOOOOOOOOOOOOO.",
    ".OwWWWWgWWWWWwO.",
    ".OwwwwwgGwwwwwO.",
    ".OwWWWWgWWWWWwO.",
    ".OwwwwwwwwwwwwO.",
    ".OOOOOOOOOOOOOO.",
    "................",
    "................",
  ], { w: "#8a5a2b", W: "#a8743c", g: "#e0b13e", G: "#f8d878", O });

  sprites["chest_open"] = mk([
    "................",
    "................",
    ".OOOOOOOOOOOOOO.",
    ".OwWWWWWWWWWWwO.",
    ".OwwwwwwwwwwwwO.",
    ".OOOOOOOOOOOOOO.",
    ".Odd?ddddd?dddO.",
    ".OddddddddddddO.",
    ".OOOOOOOOOOOOOO.",
    ".OwWWWWgWWWWWwO.",
    ".OwwwwwgGwwwwwO.",
    ".OwWWWWgWWWWWwO.",
    ".OwwwwwwwwwwwwO.",
    ".OOOOOOOOOOOOOO.",
    "................",
    "................",
  ], { w: "#8a5a2b", W: "#a8743c", g: "#e0b13e", G: "#f8d878", d: "#241a10", "?": "#48381f", O });

  sprites["chest_leg"] = mk([
    "................",
    "................",
    "......gg........",
    ".....gGGg.......",
    "...OOOOOOOOOO...",
    "..OppppppppppO..",
    ".OpPPPPPPPPPPpO.",
    ".OpppppgGgppppO.",
    ".OOOOOOOOOOOOOO.",
    ".OpPPPPgPPPPPpO.",
    ".OpppppgGpppppO.",
    ".OpPPPPgPPPPPpO.",
    ".OppppppppppppO.",
    ".OOOOOOOOOOOOOO.",
    "................",
    "................",
  ], { p: "#4a2f80", P: "#6b46b8", g: "#e0b13e", G: "#f8d878", O });

  // ================= OBJETS =================
  sprites["it_sword"] = mk([
    "................",
    "..........O.....",
    ".........OsO....",
    "........OsSO....",
    ".......OsSO.....",
    "......OsSO......",
    ".....OsSO.......",
    "....OsSO........",
    "...OgOO.........",
    "..OggO..........",
    ".OhOgO..........",
    ".OhhO...........",
    "..OO............",
    "................",
    "................",
    "................",
  ], { s: "#c8d2e8", S: "#8b9ab8", g: "#e0b13e", h: "#6a4a28", O });

  sprites["it_legend"] = mk([
    "................",
    "..........O.....",
    ".....*...OsO....",
    "........OsSO....",
    ".......OsSO.*...",
    "..*...OsSO......",
    ".....OsSO.......",
    "....OsSO........",
    "...OgOO...*.....",
    "..OggO..........",
    ".OhOgO..........",
    ".OhhO...........",
    "..OO.....*......",
    "................",
    "................",
    "................",
  ], { s: "#ffe9a8", S: "#e0b13e", g: "#8a5fd0", h: "#4a2f80", "*": "#fff0c0", O });

  sprites["it_armor"] = mk([
    "................",
    "................",
    "................",
    "...OO.....OO....",
    "..OaaO...OaaO...",
    "..OaAOOOOOAaO...",
    "..OaAAAAAAAaO...",
    "...OAAgAgAAO....",
    "...OAAAAAAAO....",
    "...OAAgAgAAO....",
    "...OaAAAAAaO....",
    "....OaaaaaO.....",
    ".....OOOOO......",
    "................",
    "................",
    "................",
  ], { a: "#6b7a99", A: "#8b9ab8", g: "#e0b13e", O });

  sprites["it_gem"] = mk([
    "................",
    "................",
    "................",
    "................",
    "......OOOO......",
    ".....OrRRrO.....",
    "....OrRWWRrO....",
    "....OrRWRRrO....",
    "....OrRRRRrO....",
    ".....OrRRrO.....",
    "......OrrO......",
    ".......OO.......",
    "................",
    "................",
    "................",
    "................",
  ], { r: "#a02838", R: "#e04858", W: "#ffb8c0", O });

  sprites["it_charm"] = mk([
    "................",
    "................",
    "......OOO.......",
    ".....O...O......",
    ".....O...O......",
    "......OOO.......",
    ".....OgggO......",
    "....OgGGGgO.....",
    "....OgGsGgO.....",
    "....OgGGGgO.....",
    ".....OgggO......",
    "......OOO.......",
    "................",
    "................",
    "................",
    "................",
  ], { g: "#c09030", G: "#e0b13e", s: "#fff0c0", O });

  sprites["it_ring"] = mk([
    "................",
    "................",
    "................",
    "................",
    "......rr........",
    ".....OrrO.......",
    "....OO..OO......",
    "...Og....gO.....",
    "...Og....gO.....",
    "...Og....gO.....",
    "....OO..OO......",
    ".....OggO.......",
    "................",
    "................",
    "................",
    "................",
  ], { g: "#e0b13e", r: "#e04858", O });

  sprites["it_torch"] = mk([
    "................",
    "......ff........",
    ".....ffFf.......",
    ".....fFFf.......",
    "......Ff........",
    ".....OhhO.......",
    ".....OhhO.......",
    "......Oh........",
    "......Oh........",
    "......Oh........",
    "......Oh........",
    "................",
    "................",
    "................",
    "................",
    "................",
  ], { f: "#ff9d2e", F: "#ffd84a", h: "#6a4a28", O });

  sprites["it_lantern"] = mk([
    "................",
    "......OO........",
    ".....O..O.......",
    "....OOOOOO......",
    "....OgFFgO......",
    "....OgFFgO......",
    "....OgffgO......",
    "....OOOOOO......",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ], { g: "#8a6838", F: "#ffd84a", f: "#ff9d2e", O });

  sprites["it_key"] = mk([
    "................",
    "................",
    "................",
    "................",
    "....OOO.........",
    "...Og.gO........",
    "...Og.gO........",
    "....OOOgggggg...",
    ".......g..g.g...",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ], { g: "#c8a05a", O });

  // ================= PORTES =================
  sprites["door_closed"] = mk([
    ".OOOOOOOOOOOOOO.",
    "OssOOOOOOOOOOssO",
    "OsOwwWwwwWwwwOsO",
    "OsOwwWwwwWwwwOsO",
    "OsOwwWwwwWwwwOsO",
    "OsOwwWwwwWwwwOsO",
    "OsOwwWwwwWwwwOsO",
    "OsOgwWwwwWwwwOsO",
    "OsOgwWwwwWwwwOsO",
    "OsOwwWwwwWwwwOsO",
    "OsOwwWwwwWwwwOsO",
    "OsOwwWwwwWwwwOsO",
    "OsOwwWwwwWwwwOsO",
    "OsOwwWwwwWwwwOsO",
    "OssOOOOOOOOOOssO",
    ".OOOOOOOOOOOOOO.",
  ], { s: "#6c6478", w: "#6a4a28", W: "#7e5a34", g: "#c8a05a", O });

  sprites["door_open"] = mk([
    ".OOOOOOOOOOOOOO.",
    "OssOOOOOOOOOOssO",
    "OsOddddddddddOsO",
    "OsOddddddddddOsO",
    "OsOddDddddddDOsO",
    "OsOddddddddddOsO",
    "OsOddddddddddOsO",
    "OsOddddddddddOsO",
    "OsOddDddddddDOsO",
    "OsOddddddddddOsO",
    "OsOddddddddddOsO",
    "OsOddddddddddOsO",
    "OsOddddddddddOsO",
    "OsOddddddddddOsO",
    "OssOOOOOOOOOOssO",
    ".OOOOOOOOOOOOOO.",
  ], { s: "#6c6478", d: "#100c1a", D: "#1e1830", O });

  // ================= SOCLE (épée légendaire au sol) =================
  sprites["pedestal"] = mk([
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "....OOOOOOOO....",
    "...OsSSSSSSsO...",
    "...OsSSSSSSsO...",
    "....OssssssO....",
    "...OsSSSSSSsO...",
    "..OssssssssssO..",
    "..OOOOOOOOOOOO..",
    "................",
  ], { s: "#5c5468", S: "#787084", O });
}
