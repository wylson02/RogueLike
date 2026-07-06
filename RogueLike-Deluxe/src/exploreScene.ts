// ===== Exploration + pause + inventaire + progression + marchand =====
import { Scene, SceneManager, panel, dimBackground } from "./scenes";
import { VW, VH, text, textShadow, drawHud, clearTweens } from "./render";
import { Input } from "./input";
import { Audio } from "./audio";
import { T } from "./i18n";
import { G, Flow } from "./game";
import { LogKind, GameEvent } from "./context";
import { StatType, Merchant, EquipSlot } from "./entities";
import { Item, ItemCatalog, sellPrice, MERCHANT_STOCK } from "./items";
import { getSprite } from "./sprites";
import { saveGame, saveSettings } from "./save";
import { TS } from "./render";
import { OptionsScene } from "./menuScenes";

export class ExploreScene implements Scene {
  private t = 0;
  private lastDt = 1 / 60;

  enter() {
    Audio.setMode(G.ctx.time.isNight ? "night" : "explore");
    G.world.snapCamera(G.ctx);
    clearTweens();
  }

  update(dt: number) {
    this.t += dt;
    this.lastDt = dt;
    const ctx = G.ctx;

    Audio.setMode(ctx.time.isNight ? "night" : "explore");

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
          else if (e.name === "chest") G.world.particles.burst(x, y, "#ffd84a", 18, 70, 0.8, 3, true);
          else if (e.name === "pickup") G.world.particles.burst(x, y, "#fff0a0", 10, 50, 0.6, 2.5, true);
          else if (e.name === "spawn") G.world.particles.burst(x, y, "#8a5fd0", 20, 80, 0.9, 3, true);
          break;
        }
        case "combat": Flow.startCombat(e.monster); return;
        case "merchant": Flow.merchant(e.merchant); return;
        case "swordCinematic": Flow.swordCinematic(); return;
        case "bossIntro": Flow.bossIntroThenLevel4(); return;
        case "end": Flow.endScreen(e.victory); return;
        case "levelLoaded":
          saveGame(G.ctx);
          G.world.snapCamera(G.ctx);
          clearTweens();
          break;
      }
    }
  }

  draw(g: CanvasRenderingContext2D) {
    G.world.draw(g, G.ctx, Math.min(0.05, this.lastDt));
    drawHud(g, G.ctx, this.t);
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
      else { saveGame(G.ctx); saveSettings(G.settings); Flow.toMenu(); }
    }
  }
  draw(g: CanvasRenderingContext2D) {
    dimBackground(g, 0.62);
    const w = 380, h = 230, x = VW / 2 - w / 2, y = VH / 2 - h / 2;
    panel(g, x, y, w, h, T("pause.title"));
    const items = [T("pause.resume"), T("pause.options"), T("pause.save")];
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
        p.removeFromInventory(item);
        item.apply(p);
        G.ctx.pushLog(T("inv.used", { item: item.name }), LogKind.System);
        Audio.sfx(item.slot !== undefined ? "confirm" : "heal");
        this.sel = Math.max(0, Math.min(this.sel, p.inventory.length - 1));
      }
    }
  }

  draw(g: CanvasRenderingContext2D) {
    dimBackground(g, 0.68);
    const w = 640, h = 420, x = VW / 2 - w / 2, y = VH / 2 - h / 2;
    panel(g, x, y, w, h, T("inv.title"));
    const p = G.ctx.player;

    // équipement en haut
    const eq = [
      { it: p.equippedWeapon, label: T("inv.equipped.w") },
      { it: p.equippedArmor, label: T("inv.equipped.a") },
      { it: p.equippedAccessory, label: T("inv.equipped.acc") },
    ];
    eq.forEach((e, i) => {
      const ex = x + 30 + i * 200;
      g.fillStyle = "rgba(40,32,60,.6)";
      g.beginPath(); g.roundRect(ex, y + 30, 185, 56, 8); g.fill();
      g.strokeStyle = "rgba(150,140,190,.3)";
      g.beginPath(); g.roundRect(ex, y + 30, 185, 56, 8); g.stroke();
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
export class MerchantScene implements Scene {
  private merchant: Merchant;
  private tab: "buy" | "sell" = "buy";
  private sel = 0;
  private t = 0;
  private flash = "";
  private flashT = 0;

  constructor(merchant: Merchant) { this.merchant = merchant; }
  enter() { Audio.sfx("talk"); }

  private sellables(): Item[] { return G.ctx.player.inventory.filter(i => i.canSell); }

  update(dt: number) {
    this.t += dt;
    this.flashT = Math.max(0, this.flashT - dt);
    if (Input.consume("cancel")) { Audio.sfx("back"); Flow.toExplore(); return; }
    if (Input.consume("left") || Input.consume("tabL")) { this.tab = "buy"; this.sel = 0; Audio.sfx("ui"); }
    if (Input.consume("right") || Input.consume("tabR")) { this.tab = "sell"; this.sel = 0; Audio.sfx("ui"); }

    const n = this.tab === "buy" ? MERCHANT_STOCK.length : this.sellables().length;
    if (n > 0) {
      if (Input.consume("up")) { this.sel = (this.sel - 1 + n) % n; Audio.sfx("ui"); }
      if (Input.consume("down")) { this.sel = (this.sel + 1) % n; Audio.sfx("ui"); }
    }

    if (Input.consume("confirm")) {
      const p = G.ctx.player;
      if (this.tab === "buy") {
        const line = MERCHANT_STOCK[this.sel];
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
      } else {
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
    const tabs: ["buy" | "sell", string][] = [["buy", T("shop.buy")], ["sell", T("shop.sell")]];
    tabs.forEach(([id, label], i) => {
      const tx = x + 120 + i * 150;
      const active = this.tab === id;
      g.fillStyle = active ? "rgba(150,90,30,.85)" : "rgba(50,38,26,.7)";
      g.beginPath(); g.roundRect(tx, y + 100, 135, 32, 6); g.fill();
      if (active) { g.strokeStyle = "#e8c078"; g.beginPath(); g.roundRect(tx, y + 100, 135, 32, 6); g.stroke(); }
      textShadow(g, label, tx + 67, y + 117, 14, active ? "#fff" : "#9a8a70", "center");
    });

    // liste
    const listY = y + 156;
    if (this.tab === "buy") {
      MERCHANT_STOCK.forEach((line, i) => {
        const ry = listY + i * 44;
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
    } else {
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
    }

    if (this.flashT > 0) {
      g.globalAlpha = Math.min(1, this.flashT * 2);
      textShadow(g, this.flash, VW / 2, y + h - 46, 13, "#ffd84a", "center");
      g.globalAlpha = 1;
    }
    text(g, T("shop.hint"), VW / 2, y + h - 20, 11, "#6e6584", "center");
  }
}
