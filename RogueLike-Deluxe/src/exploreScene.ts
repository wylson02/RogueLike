// ===== Exploration + pause + inventaire + progression + marchand =====
import { Scene, SceneManager, panel, dimBackground } from "./scenes";
import { VW, VH, text, textShadow, drawHud, clearTweens, FONT } from "./render";
import { Input } from "./input";
import { Audio } from "./audio";
import { T } from "./i18n";
import { G, Flow } from "./game";
import { LogKind, GameEvent } from "./context";
import { StatType, Merchant, EquipSlot, MAX_WEAPON_UPGRADE, Monster, MonsterRank, TalentCatalog, chooseTalent, Altar } from "./entities";
import { RelicDraftScene } from "./endlessScenes";
import { bossEncounterPages } from "./cinematics";
import { Item, ItemCatalog, sellPrice, MERCHANT_STOCK, NIGHT_MERCHANT_STOCK, NIGHT_MERCHANT_NAME } from "./items";
import { getSprite } from "./sprites";
import { saveGame, saveSettings } from "./save";
import { TS } from "./render";
import { OptionsScene } from "./menuScenes";

export class ExploreScene implements Scene {
  private t = 0;
  private lastDt = 1 / 60;
  private pendingCombat: Monster | null = null; // flash façon Pokémon avant le combat
  private flashT = 0;
  private bannerT = 0;          // bannière d'étage (Descente)
  private bannerText = "";

  enter() {
    Audio.setMode(G.ctx.time.isNight ? "night" : "explore");
    G.world.snapCamera(G.ctx);
    clearTweens();
    if (G.ctx.endless && this.bannerT <= 0 && this.t === 0) {
      this.bannerText = T("hud.depth", { n: G.ctx.runDepth }).toUpperCase();
      this.bannerT = 2.4;
    }
  }

  update(dt: number) {
    this.t += dt;
    this.lastDt = dt;
    this.bannerT = Math.max(0, this.bannerT - dt);
    const ctx = G.ctx;

    // Flash d'entrée en combat : inputs bloqués, la musique de combat démarre déjà
    if (this.pendingCombat) {
      this.flashT += dt;
      if (this.flashT >= 0.75) {
        const m = this.pendingCombat;
        this.pendingCombat = null;
        Flow.startCombat(m);
      }
      return;
    }

    Audio.setMode(ctx.time.isNight ? "night" : "explore");

    // Descente Infinie : révèle la sortie dès que l'étage de boss est nettoyé.
    if (ctx.endless) { ctx.checkEndlessBossExit(); this.handleEvents(ctx.drainEvents()); }

    // Palier de talent en attente (niveaux 3 et 6) : choix obligatoire avant de continuer
    const tier = ctx.player.pendingTalentTier();
    if (tier) { SceneManager.push(new TalentChoiceScene(tier)); return; }

    if (Input.consume("cancel")) { Audio.sfx("ui"); SceneManager.push(new PauseScene()); return; }
    if (Input.consume("inventory")) { Audio.sfx("ui"); SceneManager.push(new InventoryScene()); return; }
    if (Input.consume("progression")) { Audio.sfx("ui"); SceneManager.push(new ProgressionScene()); return; }

    const dir = Input.moveDir(performance.now());
    if (dir) {
      ctx.tryMove(dir);
      this.handleEvents(ctx.drainEvents());
    }
  }

  private handleEvents(events: GameEvent[]) {
    for (const e of events) {
      switch (e.type) {
        case "sfx": Audio.sfx(e.name); break;
        case "fx": {
          const x = e.pos.x * TS + TS / 2, y = e.pos.y * TS + TS / 2;
          if (e.name === "seal") G.world.particles.burst(x, y, "#5adfe8", 26, 90, 1, 3, true);
          else if (e.name === "chest") { G.world.particles.burst(x, y, "#ffd84a", 18, 70, 0.8, 3, true); G.world.addShake(0.3); }
          else if (e.name === "pickup") G.world.particles.burst(x, y, "#fff0a0", 10, 50, 0.6, 2.5, true);
          else if (e.name === "spawn") G.world.particles.burst(x, y, "#8a5fd0", 20, 80, 0.9, 3, true);
          else if (e.name === "secret") {
            G.world.particles.burst(x, y, "#c8b090", 34, 130, 1, 4);
            G.world.particles.burst(x, y, "#ffe9c0", 14, 90, 0.8, 3, true);
          }
          else if (e.name === "shrine") G.world.particles.burst(x, y, "#7ae8c8", 22, 80, 1, 3, true);
          else if (e.name === "trap_spikes") { G.world.particles.burst(x, y, "#c8c0cc", 20, 120, 0.7, 3.5); G.world.particles.burst(x, y, "#a02030", 14, 90, 0.9, 3, true); G.world.addShake(0.8); }
          else if (e.name === "trap_gas") { G.world.particles.burst(x, y, "#6aa84a", 26, 70, 1.4, 4, true); G.world.addShake(0.35); }
          break;
        }
        case "shake": G.world.addShake(e.power); break;
        case "altar": SceneManager.push(new AltarScene(e.altar)); return;
        case "shrine": break; // le fx/log est déjà géré ; rien d'autre à faire
        case "combat": {
          const m = e.monster;
          // Boss (mode histoire) : dialogue de rencontre (musique + le boss te parle) puis combat.
          // En Descente Infinie, on enchaîne directement pour ne pas casser le rythme des vagues.
          if (!G.ctx.endless && bossEncounterPages(m.nameKey) && !m.spokeIntro) {
            m.spokeIntro = true;
            Flow.bossEncounter(m);
            return;
          }
          this.pendingCombat = m;
          this.flashT = 0;
          Audio.setMode(m.rank === MonsterRank.Boss ? "boss" : "combat");
          Audio.sfx("hit");
          return;
        }
        case "merchant": Flow.merchant(e.merchant); return;
        case "lore": Flow.loreCinematic(e.mark.cineKey); return;
        case "swordCinematic": Flow.swordCinematic(); return;
        case "bossIntro": Flow.bossIntroThenLevel4(); return;
        case "depthsIntro": Flow.depthsIntroThenLevel5(); return;
        case "end": Flow.endScreen(e.victory, e.trueEnding); return;
        case "floorCleared": Flow.relicDraft(); return;
        case "levelLoaded":
          if (!G.ctx.endless) saveGame(G.ctx); // les runs Descente ne sont pas resumables (permadeath)
          G.world.snapCamera(G.ctx);
          clearTweens();
          if (G.ctx.endless) {
            this.bannerText = T("hud.depth", { n: G.ctx.runDepth }).toUpperCase();
            this.bannerT = 2.4;
          }
          break;
      }
    }
  }

  draw(g: CanvasRenderingContext2D) {
    G.world.draw(g, G.ctx, Math.min(0.05, this.lastDt));
    drawHud(g, G.ctx, this.t);

    // Bannière d'étage (Descente) : la profondeur s'annonce en lettres de pierre
    if (this.bannerT > 0) {
      const total = 2.4;
      const t = total - this.bannerT;
      const aIn = Math.min(1, t / 0.35);
      const aOut = Math.min(1, this.bannerT / 0.5);
      const a = Math.min(aIn, aOut);
      const slideX = (1 - aIn) * (1 - aIn) * -160;
      g.save();
      g.globalAlpha = a * 0.85;
      const bh = 74, by = VH * 0.3;
      const grad = g.createLinearGradient(0, by, 0, by + bh);
      grad.addColorStop(0, "rgba(10,6,18,0)");
      grad.addColorStop(0.5, "rgba(10,6,18,.92)");
      grad.addColorStop(1, "rgba(10,6,18,0)");
      g.fillStyle = grad;
      g.fillRect(0, by, VW, bh);
      g.globalAlpha = a;
      g.shadowColor = "#8a5fd0"; g.shadowBlur = 18;
      g.font = `bold 34px ${FONT}`;
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillStyle = "#e8d8ff";
      g.fillText(this.bannerText, VW / 2 + slideX, by + bh / 2);
      g.restore();
    }

    // 3 éclairs blancs façon Pokémon avant la bascule en combat
    if (this.pendingCombat) {
      const a = Math.abs(Math.sin(this.flashT * Math.PI * 4)) * 0.85;
      g.fillStyle = `rgba(255,255,255,${a})`;
      g.fillRect(0, 0, VW, VH);
    }
  }
}

// ===== Autel maudit : le pacte — un pouvoir épique contre une malédiction =====
export class AltarScene implements Scene {
  private sel = 0; // 0 = sceller le pacte, 1 = refuser
  private t = 0;
  constructor(private altar: Altar) {}

  update(dt: number) {
    this.t += dt;
    if (Input.consume("cancel")) { G.ctx.refuseAltar(this.altar); Audio.sfx("back"); SceneManager.pop(); return; }
    if (Input.consume("left") || Input.consume("right") || Input.consume("up") || Input.consume("down")) {
      this.sel = 1 - this.sel; Audio.sfx("ui");
    }
    if (Input.consume("confirm")) {
      if (this.sel === 1) {
        G.ctx.refuseAltar(this.altar);
        Audio.sfx("back");
        SceneManager.pop();
      } else {
        const curseId = G.ctx.acceptAltar(this.altar);
        Audio.sfx("curse");
        G.world.addShake(1.2);
        SceneManager.pop();
        // Le pacte scellé : un draft épique s'ouvre (sans changer d'étage)
        SceneManager.push(new RelicDraftScene({ epicOnly: true, curseId, onDone: () => SceneManager.pop() }));
      }
    }
  }

  draw(g: CanvasRenderingContext2D) {
    dimBackground(g, 0.78);
    const w = 560, h = 300, x = VW / 2 - w / 2, y = VH / 2 - h / 2;
    panel(g, x, y, w, h, T("altar.title"));
    const pulse = 0.7 + Math.sin(this.t * 3) * 0.3;
    g.save();
    g.shadowColor = "#c04888"; g.shadowBlur = 20 * pulse;
    textShadow(g, "☠", VW / 2, y + 64, 38, "#e060a0", "center");
    g.restore();
    text(g, T("altar.desc1"), VW / 2, y + 116, 14, "#d8c8e8", "center");
    text(g, T("altar.desc2"), VW / 2, y + 140, 13, "#a89ec0", "center");
    text(g, T("altar.desc3"), VW / 2, y + 164, 12, "#8a6080", "center");

    const opts = [T("altar.accept"), T("altar.refuse")];
    opts.forEach((o, i) => {
      const oy = y + 210 + 0, ox = VW / 2 + (i === 0 ? -130 : 130);
      const selected = i === this.sel;
      const bw2 = 220, bh2 = 40;
      g.fillStyle = selected ? (i === 0 ? "rgba(140,30,80,.85)" : "rgba(60,60,80,.85)") : "rgba(30,24,44,.7)";
      g.beginPath(); g.roundRect(ox - bw2 / 2, oy - bh2 / 2, bw2, bh2, 8); g.fill();
      if (selected) {
        g.strokeStyle = i === 0 ? "#ff90c0" : "#b0b8d0"; g.lineWidth = 2;
        g.beginPath(); g.roundRect(ox - bw2 / 2, oy - bh2 / 2, bw2, bh2, 8); g.stroke();
      }
      textShadow(g, o, ox, oy + 1, 14, selected ? "#fff" : "#9a92ac", "center");
    });
    text(g, T("altar.hint"), VW / 2, y + h - 18, 11, "#6e6584", "center");
  }
}

// ===== Choix de talent (niveaux 3 et 6) =====
export class TalentChoiceScene implements Scene {
  private sel = 0;
  constructor(private tier: 1 | 2) {}

  update(dt: number) {
    if (Input.consume("left") || Input.consume("up")) { this.sel = (this.sel + 1) % 2; Audio.sfx("ui"); }
    if (Input.consume("right") || Input.consume("down")) { this.sel = (this.sel + 1) % 2; Audio.sfx("ui"); }
    if (Input.consume("confirm")) {
      const p = G.ctx.player;
      const def = TalentCatalog[p.classId][this.tier][this.sel];
      chooseTalent(p, def);
      G.ctx.pushLog(T("talent.chosen", { name: T(def.nameKey) }), LogKind.System);
      Audio.sfx("levelup");
      saveGame(G.ctx);
      SceneManager.pop();
    }
  }

  draw(g: CanvasRenderingContext2D) {
    dimBackground(g, 0.78);
    const w = 620, h = 280, x = VW / 2 - w / 2, y = VH / 2 - h / 2;
    panel(g, x, y, w, h, T("talent.title", { n: this.tier === 1 ? 3 : 6 }));
    text(g, T("talent.sub"), VW / 2, y + 44, 13, "#a89ec0", "center");

    const defs = TalentCatalog[G.ctx.player.classId][this.tier];
    const cardW = 270, cardH = 150, gap = 24;
    const startX = x + (w - (cardW * 2 + gap)) / 2;
    defs.forEach((def, i) => {
      const cx = startX + i * (cardW + gap), cy = y + 66;
      const selected = i === this.sel;
      g.fillStyle = selected ? "rgba(120,25,25,.55)" : "rgba(30,24,44,.6)";
      g.beginPath(); g.roundRect(cx, cy, cardW, cardH, 8); g.fill();
      g.strokeStyle = selected ? "#ffb0a0" : "rgba(140,130,170,.35)";
      g.lineWidth = selected ? 2 : 1;
      g.beginPath(); g.roundRect(cx, cy, cardW, cardH, 8); g.stroke();
      textShadow(g, T(def.nameKey), cx + cardW / 2, cy + 30, 16, selected ? "#fff" : "#c8c0d4", "center");
      // description sur 2 lignes max
      const desc = T(def.descKey);
      const mid = desc.length > 34 ? desc.lastIndexOf(" ", 34) : -1;
      if (mid > 0) {
        text(g, desc.slice(0, mid), cx + cardW / 2, cy + 70, 12, selected ? "#e8dfc8" : "#9a92ac", "center");
        text(g, desc.slice(mid + 1), cx + cardW / 2, cy + 90, 12, selected ? "#e8dfc8" : "#9a92ac", "center");
      } else {
        text(g, desc, cx + cardW / 2, cy + 80, 12, selected ? "#e8dfc8" : "#9a92ac", "center");
      }
    });
    text(g, T("talent.hint"), VW / 2, y + h - 16, 12, "#8a8098", "center");
  }
}

// ===== Pause =====
export class PauseScene implements Scene {
  private sel = 0;
  update(dt: number) {
    if (Input.consume("cancel")) { Audio.sfx("back"); SceneManager.pop(); return; }
    if (Input.consume("up")) { this.sel = (this.sel + 2) % 3; Audio.sfx("ui"); }
    if (Input.consume("down")) { this.sel = (this.sel + 1) % 3; Audio.sfx("ui"); }
    if (Input.consume("confirm")) {
      Audio.sfx("confirm");
      if (this.sel === 0) SceneManager.pop();
      else if (this.sel === 1) { SceneManager.push(new OptionsScene()); }
      else if (G.ctx.endless) {
        // En Descente : abandonner le run banque l'essence gagnée et affiche le résumé.
        saveSettings(G.settings);
        Flow.runSummary();
      } else { saveGame(G.ctx); saveSettings(G.settings); Flow.toMenu(); }
    }
  }
  draw(g: CanvasRenderingContext2D) {
    dimBackground(g, 0.62);
    const w = 380, h = 230, x = VW / 2 - w / 2, y = VH / 2 - h / 2;
    panel(g, x, y, w, h, T("pause.title"));
    const items = [T("pause.resume"), T("pause.options"), G.ctx.endless ? T("pause.abandon") : T("pause.save")];
    items.forEach((it, i) => {
      const ry = y + 66 + i * 50;
      if (i === this.sel) {
        g.fillStyle = "rgba(120,25,25,.6)";
        g.beginPath(); g.roundRect(x + 20, ry - 17, w - 40, 36, 6); g.fill();
        textShadow(g, "▶ " + it, VW / 2, ry, 15, "#fff", "center");
      } else {
        text(g, it, VW / 2, ry, 15, "#a89ec0", "center");
      }
    });
  }
}

// ===== Inventaire =====
export class InventoryScene implements Scene {
  private sel = 0;
  update(dt: number) {
    const p = G.ctx.player;
    const n = p.inventory.length;
    if (Input.consume("cancel") || Input.consume("inventory")) { Audio.sfx("back"); SceneManager.pop(); return; }
    if (n > 0) {
      if (Input.consume("up")) { this.sel = (this.sel - 1 + n) % n; Audio.sfx("ui"); }
      if (Input.consume("down")) { this.sel = (this.sel + 1) % n; Audio.sfx("ui"); }
      if (Input.consume("confirm")) {
        this.sel = Math.min(this.sel, n - 1);
        const item = p.inventory[this.sel];
        if (item.consumable) {
          G.ctx.pushLog(T("inv.combatonly"), LogKind.Warning);
          Audio.sfx("locked");
        } else if (item.quest) {
          G.ctx.pushLog(T("inv.questitem"), LogKind.Warning);
          Audio.sfx("locked");
        } else {
          p.removeFromInventory(item);
          item.apply(p);
          G.ctx.pushLog(T("inv.used", { item: item.name }), LogKind.System);
          Audio.sfx(item.slot !== undefined ? "confirm" : "heal");
          this.sel = Math.max(0, Math.min(this.sel, p.inventory.length - 1));
        }
      }
    }
  }

  draw(g: CanvasRenderingContext2D) {
    dimBackground(g, 0.68);
    const w = 760, h = 420, x = VW / 2 - w / 2, y = VH / 2 - h / 2;
    panel(g, x, y, w, h, T("inv.title"));
    const p = G.ctx.player;

    // équipement en haut
    const eq = [
      { it: p.equippedWeapon, label: T("inv.equipped.w") },
      { it: p.equippedArmor, label: T("inv.equipped.a") },
      { it: p.equippedAccessory, label: T("inv.equipped.acc") },
      { it: p.equippedRelic, label: T("inv.equipped.relic") },
    ];
    const slotW = 155, slotGap = 15;
    eq.forEach((e, i) => {
      const ex = x + 30 + i * (slotW + slotGap);
      g.fillStyle = "rgba(40,32,60,.6)";
      g.beginPath(); g.roundRect(ex, y + 30, slotW, 56, 8); g.fill();
      g.strokeStyle = "rgba(150,140,190,.3)";
      g.beginPath(); g.roundRect(ex, y + 30, slotW, 56, 8); g.stroke();
      if (e.it) {
        const spr = getSprite(e.it.sprite);
        if (spr) { g.imageSmoothingEnabled = false; g.drawImage(spr, ex + 8, y + 38, 40, 40); }
        text(g, e.it.name, ex + 54, y + 50, 12, "#ffd84a");
        text(g, e.label, ex + 54, y + 68, 10, "#8a80a0");
      } else {
        text(g, "—", ex + 16, y + 58, 14, "#5a5470");
        text(g, e.label, ex + 40, y + 58, 10, "#5a5470");
      }
    });

    // liste
    const listY = y + 104;
    if (p.inventory.length === 0) {
      text(g, T("inv.empty"), VW / 2, listY + 60, 15, "#8a80a0", "center");
    } else {
      this.sel = Math.min(this.sel, p.inventory.length - 1);
      const maxShow = 7;
      const start = Math.max(0, Math.min(this.sel - 3, p.inventory.length - maxShow));
      p.inventory.slice(start, start + maxShow).forEach((it, vi) => {
        const i = start + vi;
        const ry = listY + vi * 38;
        const selected = i === this.sel;
        if (selected) {
          g.fillStyle = "rgba(120,25,25,.55)";
          g.beginPath(); g.roundRect(x + 20, ry - 3, w - 40, 34, 6); g.fill();
        }
        const spr = getSprite(it.sprite);
        if (spr) { g.imageSmoothingEnabled = false; g.drawImage(spr, x + 30, ry, 28, 28); }
        text(g, it.name, x + 70, ry + 14, 14, selected ? "#fff" : (it.legendary ? "#ffd84a" : "#c8c0d4"));
        text(g, it.statsLines().join("  "), x + 300, ry + 14, 11, selected ? "#e8c8a0" : "#8a80a0");
      });
      // description de l'objet sélectionné
      const cur = p.inventory[this.sel];
      if (cur) text(g, cur.description, VW / 2, y + h - 46, 12, "#a89ec0", "center");
    }
    text(g, T("inv.hint"), VW / 2, y + h - 20, 11, "#6e6584", "center");
  }
}

// ===== Progression =====
export class ProgressionScene implements Scene {
  private sel = 0;
  update(dt: number) {
    if (Input.consume("cancel") || Input.consume("progression")) { Audio.sfx("back"); SceneManager.pop(); return; }
    if (Input.consume("up")) { this.sel = (this.sel + 4) % 5; Audio.sfx("ui"); }
    if (Input.consume("down")) { this.sel = (this.sel + 1) % 5; Audio.sfx("ui"); }
    if (Input.consume("confirm")) {
      const p = G.ctx.player;
      if (p.statPoints <= 0) { G.ctx.pushLog(T("prog.none"), LogKind.Warning); Audio.sfx("locked"); return; }
      const stat = [StatType.MaxHp, StatType.Attack, StatType.Armor, StatType.CritChance, StatType.LifeSteal][this.sel];
      if (p.spendStatPoint(stat)) {
        G.ctx.pushLog(T("prog.spent"), LogKind.System);
        G.ctx.showToast(T("prog.toast"), "#08130a", "#5abf6e", 6);
        Audio.sfx("levelup");
      }
    }
  }

  draw(g: CanvasRenderingContext2D) {
    dimBackground(g, 0.68);
    const w = 560, h = 420, x = VW / 2 - w / 2, y = VH / 2 - h / 2;
    panel(g, x, y, w, h, T("prog.title"));
    const p = G.ctx.player;

    textShadow(g, T("prog.level", { n: p.level }), x + 40, y + 44, 16, "#8fd4ff");
    text(g, T("prog.xp", { xp: p.xp, next: p.xpToNext }), x + 40, y + 68, 13, "#7ab8e8");
    const ptsCol = p.statPoints > 0 ? "#7ae87a" : "#8a80a0";
    textShadow(g, T("prog.points", { n: p.statPoints }), x + w - 40, y + 44, 16, ptsCol, "right");

    const rows = [
      { label: T("prog.maxhp"), cur: `${p.hp}/${p.maxHp}`, col: "#ff8a8a" },
      { label: T("prog.atk"), cur: `${p.attack}`, col: "#e8b878" },
      { label: T("prog.arm"), cur: `${p.armor}`, col: "#a8b8d8" },
      { label: T("prog.crit"), cur: `${p.critChancePercent}%`, col: "#ffd84a" },
      { label: T("prog.ls"), cur: `${p.lifeStealPercent}%`, col: "#e88ae8" },
    ];
    rows.forEach((r, i) => {
      const ry = y + 110 + i * 50;
      const selected = i === this.sel;
      if (selected) {
        g.fillStyle = "rgba(120,25,25,.55)";
        g.beginPath(); g.roundRect(x + 24, ry - 18, w - 48, 40, 6); g.fill();
      }
      text(g, (selected ? "▶ " : "  ") + r.label, x + 40, ry, 15, selected ? "#fff" : "#a89ec0");
      textShadow(g, r.cur, x + w - 60, ry, 15, r.col, "right");
      if (selected && p.statPoints > 0) textShadow(g, "+", x + w - 36, ry, 18, "#7ae87a", "center");
    });
    text(g, T("prog.hint"), VW / 2, y + h - 20, 11, "#6e6584", "center");
  }
}

// ===== Marchand =====
type ShopTab = "buy" | "sell" | "forge" | "arena";

export class MerchantScene implements Scene {
  private merchant: Merchant;
  private tab: ShopTab = "buy";
  private sel = 0;
  private forgeSlot: EquipSlot.Weapon | EquipSlot.Armor = EquipSlot.Weapon;
  private t = 0;
  private flash = "";
  private flashT = 0;

  constructor(merchant: Merchant) { this.merchant = merchant; }
  enter() { Audio.sfx("talk"); }

  private sellables(): Item[] { return G.ctx.player.inventory.filter(i => i.canSell); }
  private stock() { return this.merchant.name === NIGHT_MERCHANT_NAME ? NIGHT_MERCHANT_STOCK : MERCHANT_STOCK; }
  // L'arène est le privilège de Vesna — pas de la rôdeuse nocturne
  private tabOrder(): ShopTab[] {
    return this.merchant.name === NIGHT_MERCHANT_NAME ? ["buy", "sell", "forge"] : ["buy", "sell", "forge", "arena"];
  }

  private cycleTab(dir: 1 | -1) {
    const order = this.tabOrder();
    const i = (order.indexOf(this.tab) + dir + order.length) % order.length;
    this.tab = order[i];
    this.sel = 0;
    Audio.sfx("ui");
  }

  update(dt: number) {
    this.t += dt;
    this.flashT = Math.max(0, this.flashT - dt);
    if (Input.consume("cancel")) { Audio.sfx("back"); Flow.toExplore(); return; }
    if (Input.consume("left") || Input.consume("tabL")) this.cycleTab(-1);
    if (Input.consume("right") || Input.consume("tabR")) this.cycleTab(1);

    const n = this.tab === "buy" ? this.stock().length : this.tab === "sell" ? this.sellables().length : 0;
    if (n > 0) {
      if (Input.consume("up")) { this.sel = (this.sel - 1 + n) % n; Audio.sfx("ui"); }
      if (Input.consume("down")) { this.sel = (this.sel + 1) % n; Audio.sfx("ui"); }
    } else if (this.tab === "forge") {
      if (Input.consume("up") || Input.consume("down")) {
        this.forgeSlot = this.forgeSlot === EquipSlot.Weapon ? EquipSlot.Armor : EquipSlot.Weapon;
        Audio.sfx("ui");
      }
    }

    if (Input.consume("confirm")) {
      const p = G.ctx.player;
      if (this.tab === "buy") {
        const line = this.stock()[this.sel];
        if (p.gold < line.price) {
          G.ctx.pushLog(T("shop.poor"), LogKind.Warning);
          this.flash = T("shop.poor"); this.flashT = 1.4;
          Audio.sfx("locked");
        } else {
          p.spendGold(line.price);
          const item = ItemCatalog.create(line.id, { x: -1, y: -1 });
          p.addToInventory(item);
          G.ctx.pushLog(T("shop.bought", { item: item.name, n: line.price }), LogKind.Loot);
          this.flash = T("shop.bought", { item: item.name, n: line.price }); this.flashT = 1.4;
          Audio.sfx("coin");
        }
      } else if (this.tab === "sell") {
        const list = this.sellables();
        if (list.length > 0) {
          this.sel = Math.min(this.sel, list.length - 1);
          const item = list[this.sel];
          const price = sellPrice(item);
          p.removeFromInventory(item);
          p.addGold(price);
          G.ctx.pushLog(T("shop.sold", { item: item.name, n: price }), LogKind.Loot);
          this.flash = T("shop.sold", { item: item.name, n: price }); this.flashT = 1.4;
          Audio.sfx("coin");
          this.sel = Math.max(0, Math.min(this.sel, this.sellables().length - 1));
        }
      } else if (this.tab === "arena") {
        Audio.sfx("confirm");
        const first = G.ctx.startArenaWave();
        Flow.startCombat(first);
        return;
      } else {
        const slot = this.forgeSlot;
        const equipped = slot === EquipSlot.Weapon ? p.equippedWeapon : p.equippedArmor;
        const noEquipKey = slot === EquipSlot.Weapon ? "shop.forge.noweapon" : "shop.forge.noarmor";
        const doneKey = slot === EquipSlot.Weapon ? "shop.forge.done" : "shop.forge.done.armor";
        if (!equipped) {
          this.flash = T(noEquipKey); this.flashT = 1.4;
          Audio.sfx("locked");
        } else if (p.nextUpgradeCost(slot) === null) {
          this.flash = T("shop.forge.max"); this.flashT = 1.4;
          Audio.sfx("locked");
        } else if (p.gold < (p.nextUpgradeCost(slot) ?? Infinity)) {
          G.ctx.pushLog(T("shop.poor"), LogKind.Warning);
          this.flash = T("shop.poor"); this.flashT = 1.4;
          Audio.sfx("locked");
        } else {
          p.upgradeSlot(slot);
          const lvl = slot === EquipSlot.Weapon ? p.weaponUpgradeLevel : p.armorUpgradeLevel;
          G.ctx.pushLog(T(doneKey, { n: lvl }), LogKind.Loot);
          this.flash = T(doneKey, { n: lvl }); this.flashT = 1.4;
          Audio.sfx("coin");
        }
      }
    }
  }

  draw(g: CanvasRenderingContext2D) {
    // fond boutique
    const grad = g.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, "#14100c");
    grad.addColorStop(1, "#241a10");
    g.fillStyle = grad;
    g.fillRect(0, 0, VW, VH);

    const w = 720, h = 460, x = VW / 2 - w / 2, y = VH / 2 - h / 2;
    panel(g, x, y, w, h, T("shop.title", { name: this.merchant.name }));

    // marchand animé
    const spr = getSprite("merchant");
    if (spr) {
      g.imageSmoothingEnabled = false;
      g.drawImage(spr, x + 24, y + 34 + Math.sin(this.t * 2) * 3, 72, 72);
    }
    textShadow(g, T("shop.gold", { n: G.ctx.player.gold }), x + w - 36, y + 46, 17, "#ffd84a", "right");

    // stats build
    const p = G.ctx.player;
    text(g, `ATK ${p.attack}  ARM ${p.armor}  CRIT ${p.critChancePercent}%  ${p.lifeStealPercent}% LS  PV ${p.hp}/${p.maxHp}`,
      x + w - 36, y + 74, 12, "#a89ec0", "right");

    // onglets
    const labels: Record<ShopTab, string> = { buy: T("shop.buy"), sell: T("shop.sell"), forge: T("shop.forge"), arena: T("shop.arena") };
    const order = this.tabOrder();
    const tabW = order.length > 3 ? 128 : 135, tabGap = order.length > 3 ? 138 : 150;
    order.forEach((id, i) => {
      const tx = x + 110 + i * tabGap;
      const active = this.tab === id;
      g.fillStyle = active ? "rgba(150,90,30,.85)" : "rgba(50,38,26,.7)";
      g.beginPath(); g.roundRect(tx, y + 100, tabW, 32, 6); g.fill();
      if (active) { g.strokeStyle = "#e8c078"; g.beginPath(); g.roundRect(tx, y + 100, tabW, 32, 6); g.stroke(); }
      textShadow(g, labels[id], tx + tabW / 2, y + 117, 14, active ? "#fff" : "#9a8a70", "center");
    });

    // liste
    const listY = y + 156;
    if (this.tab === "buy") {
      const stock = this.stock();
      this.sel = Math.min(this.sel, stock.length - 1);
      const maxShow = 6;
      const start = Math.max(0, Math.min(this.sel - 2, stock.length - maxShow));
      stock.slice(start, start + maxShow).forEach((line, vi) => {
        const i = start + vi;
        const ry = listY + vi * 44;
        const selected = i === this.sel;
        const afford = G.ctx.player.gold >= line.price;
        if (selected) {
          g.fillStyle = "rgba(150,90,30,.45)";
          g.beginPath(); g.roundRect(x + 24, ry - 5, w - 48, 38, 6); g.fill();
        }
        const item = ItemCatalog.create(line.id, { x: -1, y: -1 });
        const sprI = getSprite(item.sprite);
        if (sprI) { g.imageSmoothingEnabled = false; g.drawImage(sprI, x + 36, ry - 1, 30, 30); }
        text(g, T(line.labelKey), x + 80, ry + 14, 14, selected ? "#fff" : "#c8bca8");
        textShadow(g, line.price + " ⬤", x + w - 48, ry + 14, 14, afford ? "#ffd84a" : "#8a5050", "right");
      });
    } else if (this.tab === "sell") {
      const list = this.sellables();
      if (list.length === 0) {
        text(g, T("shop.empty"), VW / 2, listY + 60, 15, "#8a80a0", "center");
      } else {
        this.sel = Math.min(this.sel, list.length - 1);
        const maxShow = 6;
        const start = Math.max(0, Math.min(this.sel - 2, list.length - maxShow));
        list.slice(start, start + maxShow).forEach((it, vi) => {
          const i = start + vi;
          const ry = listY + vi * 44;
          const selected = i === this.sel;
          if (selected) {
            g.fillStyle = "rgba(150,90,30,.45)";
            g.beginPath(); g.roundRect(x + 24, ry - 5, w - 48, 38, 6); g.fill();
          }
          const sprI = getSprite(it.sprite);
          if (sprI) { g.imageSmoothingEnabled = false; g.drawImage(sprI, x + 36, ry - 1, 30, 30); }
          text(g, it.name, x + 80, ry + 14, 14, selected ? "#fff" : "#c8bca8");
          textShadow(g, "+" + sellPrice(it) + " ⬤", x + w - 48, ry + 14, 14, "#7ae87a", "right");
        });
      }
    } else if (this.tab === "arena") {
      // arène : vagues de monstres contre récompenses
      const ctx = G.ctx;
      textShadow(g, T("arena.wave", { n: ctx.arenaWave }), VW / 2, listY + 20, 20, "#e8c078", "center");
      if (ctx.isArenaChampionWave())
        textShadow(g, T("arena.champion"), VW / 2, listY + 50, 13, "#c8a8ff", "center");
      else
        text(g, T("arena.desc"), VW / 2, listY + 50, 13, "#a89ec0", "center");
      text(g, T("arena.reward", { n: ctx.arenaNextReward() }), VW / 2, listY + 84, 14, "#ffd84a", "center");
      text(g, T("arena.warn"), VW / 2, listY + 112, 12, "#c88a7a", "center");
      text(g, T("arena.hint"), VW / 2, listY + 140, 12, "#8a80a0", "center");
    } else {
      // forge : amélioration de l'arme ou de l'armure équipée (↑↓ change de slot)
      const slot = this.forgeSlot;
      const equipped = slot === EquipSlot.Weapon ? p.equippedWeapon : p.equippedArmor;
      const noEquipKey = slot === EquipSlot.Weapon ? "shop.forge.noweapon" : "shop.forge.noarmor";
      const slotLabel = T(slot === EquipSlot.Weapon ? "shop.forge.slot.weapon" : "shop.forge.slot.armor");
      const lvl = slot === EquipSlot.Weapon ? p.weaponUpgradeLevel : p.armorUpgradeLevel;
      const cost = p.nextUpgradeCost(slot);
      const iname = equipped ? equipped.name : T(noEquipKey);
      textShadow(g, `${slotLabel} — ${iname}`, VW / 2, listY + 20, 17, equipped ? "#ffd84a" : "#8a5470", "center");
      text(g, T("shop.forge.level", { n: lvl, max: MAX_WEAPON_UPGRADE }), VW / 2, listY + 50, 13, "#a89ec0", "center");
      if (cost === null) {
        text(g, T("shop.forge.max"), VW / 2, listY + 90, 14, "#7ae87a", "center");
      } else {
        const afford = G.ctx.player.gold >= cost;
        text(g, T("shop.forge.next", { n: cost }), VW / 2, listY + 90, 14, afford ? "#ffd84a" : "#8a5050", "center");
      }
      text(g, T("shop.forge.hint2"), VW / 2, listY + 118, 12, "#8a80a0", "center");
    }

    if (this.flashT > 0) {
      g.globalAlpha = Math.min(1, this.flashT * 2);
      textShadow(g, this.flash, VW / 2, y + h - 46, 13, "#ffd84a", "center");
      g.globalAlpha = 1;
    }
    text(g, T("shop.hint"), VW / 2, y + h - 20, 11, "#6e6584", "center");
  }
}
