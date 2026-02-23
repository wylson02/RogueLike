namespace RogueLike.App.States;

using System;
using System.Linq;

using RogueLike.App;
using RogueLike.App.Services;
using RogueLike.Domain;
using RogueLike.Domain.Entities;
using RogueLike.Domain.Items;
using RogueLike.Domain.Items.Quest;
using RogueLike.UI;

public sealed class ExplorationState : IGameState
{
    public string Name => "Exploration";

    private static readonly Position Map1ArmoryDoorPos = new Position(5, 13);
    private static readonly string Map1GuardName = "Sentinelle";

    public void Update(GameContext ctx)
    {
        var cmd = ConsoleInput.ReadExplorationCommand();

        if (cmd.DevLoadLevel3Requested)
        {
            ctx.PushLog("DEV: load level 3", GameContext.LogKind.System);
            ctx.LoadLevel(3);
            ctx.State = new ExplorationState();
            return;
        }

        if (cmd.InventoryRequested)
        {
            ctx.State = new InventoryState(previous: this);
            return;
        }

        if (cmd.ProgressionRequested)
        {
            ctx.State = new ProgressionState(previous: this);
            return;
        }

        var dir = cmd.Direction;
        if (dir == Direction.None) return;

        var prev = ctx.Player.Pos;
        var next = ctx.Player.Pos.Move(dir);

        if (!ctx.Map.InBounds(next)) return;

        // ===== Door closed first (blocks movement) =====
        if (ctx.IsDoorClosed(next))
        {
            if (ctx.CurrentLevel == 1 && next == Map1ArmoryDoorPos)
            {
                if (!HasItem<Map1ArmoryKeyItem>(ctx.Player))
                {
                    ctx.PushLog("La porte est verrouillée. Il te faut une clé.", GameContext.LogKind.Warning);
                    return;
                }

                RemoveFirstItem<Map1ArmoryKeyItem>(ctx.Player);
                ctx.OpenDoor(next);
                ctx.PushLog("🔓 La clé tourne… la porte de l’armurerie s’ouvre.", GameContext.LogKind.System);

                // maintenant walkable => on bouge
                ctx.Player.SetPosition(next);
                ctx.UpdateVision();
                ctx.AdvanceTimeAfterPlayerMove();
                MonstersTurn(ctx);
                return;
            }

            ctx.PushLog("La porte est scellée.", GameContext.LogKind.Warning);
            return;
        }

        // ===== not walkable (wall etc) =====
        if (!ctx.Map.IsWalkable(next)) return;

        // ===== Guard blocks the exit path (Map1) =====
        var pnjBlock = ctx.PnjAt(next);
        if (pnjBlock is not null && ctx.CurrentLevel == 1 && pnjBlock.Name == Map1GuardName)
        {
            if (!HasAnyWeapon(ctx.Player))
            {
                ctx.PushLog("Sentinelle : Halte. Aucun passage sans arme.", GameContext.LogKind.Warning);
                return;
            }

            ctx.PushLog("Sentinelle : Tu es armé. Passe.", GameContext.LogKind.System);

            if (TryMoveGuardAside(ctx, pnjBlock, playerFrom: prev))
                ctx.ShowToast("La Sentinelle s'écarte.", ConsoleColor.Black, ConsoleColor.Green, durationTicks: 8);

            ctx.UpdateVision();
            return;
        }

        // ===== Chest BEFORE moving (so it triggers when stepping on it) =====
        var chest = ctx.ChestAt(next);
        if (chest is not null)
        {
            ctx.Player.SetPosition(next);
            ctx.OpenChest(chest);

            ctx.UpdateVision();
            ctx.AdvanceTimeAfterPlayerMove();
            MonstersTurn(ctx);
            return;
        }

        // ===== Combat if stepping on monster =====
        var enemy = ctx.MonsterAt(next);
        if (enemy is not null)
        {
            ctx.State = new CombatState(enemy);
            return;
        }

        // ===== Move =====
        ctx.Player.SetPosition(next);

        // ===== Merchant (if your project still uses it this way) =====
        if (ctx.IsMerchantAt(next) && ctx.Merchant is not null)
        {
            ctx.UpdateVision();
            ctx.State = new MerchantState(previous: this, ctx.Merchant);
            return;
        }

        // ===== Seals (Map3) =====
        var seal = ctx.SealAt(next);
        if (seal is not null)
        {
            seal.Activate();
            ctx.IncrementSealsActivated();

            if (ctx.CurrentLevel == 3 && ctx.SealsActivated == 2 && !ctx.Map3LastSealHintShown)
            {
                ctx.ShowMap3LastSealHintOnce();
                ctx.PushLog("Le dernier sceau résonne faiblement… quelque part dans le temple.", GameContext.LogKind.System);
            }

            ctx.PushLog($"Sceau {seal.Id} activé ({ctx.SealsActivated}/3).", GameContext.LogKind.System);

            if (ctx.SealsActivated >= 3)
            {
                Map3Scripting.OpenCentralDoors(ctx);
                ctx.PushLog("Les verrous anciens cèdent... les portes de la salle centrale s'ouvrent.", GameContext.LogKind.System);
            }

            ctx.UpdateVision();
            ctx.AdvanceTimeAfterPlayerMove();
            MonstersTurn(ctx);
            return;
        }

        // ===== PNJ talk (on the tile you are now on) =====
        var pnj = ctx.PnjAt(next);
        if (pnj is not null)
        {
            if (ctx.CurrentLevel == 1 && pnj.Name == "Lysa")
            {
                bool allDead = !ctx.Monsters.Any(m => !m.IsDead);
                if (!allDead)
                {
                    ctx.PushLog("Lysa : N-non… je… je peux pas parler. Tue-les… tous…", GameContext.LogKind.Warning);
                }
                else
                {
                    pnj.SetMessage("Merci… Tiens. Cette clé ouvre l’armurerie. Prends ce que tu peux.");
                    ctx.PushLog($"{pnj.Name} : {pnj.Talk()}", GameContext.LogKind.System);

                    var giftName = pnj.GiveGift();
                    if (giftName is not null)
                    {
                        var gift = ItemCatalog.Create(giftName, next);
                        ctx.Player.AddToInventory(gift);
                        ctx.PushLog($"Vous recevez : {gift.Name}", GameContext.LogKind.Loot);
                    }
                }
            }
            else
            {
                ctx.PushLog($"{pnj.Name} : {pnj.Talk()}", GameContext.LogKind.System);

                var giftName = pnj.GiveGift();
                if (giftName is not null)
                {
                    var gift = ItemCatalog.Create(giftName, next);
                    ctx.Player.AddToInventory(gift);
                    ctx.PushLog($"Vous recevez : {gift.Name}", GameContext.LogKind.Loot);
                }
            }
        }

        // ===== Item pickup (after moving) =====
        var item = ctx.ItemAt(next);
        if (item is not null)
        {
            bool picked = ctx.ItemService.TryPickup(ctx, next);
            if (picked && ctx.CurrentLevel == 3 && item is LegendarySwordItem)
            {
                ctx.MarkLegendarySwordPicked();
                ctx.GrantLegendaryEmpower();

                LegendarySwordCinematicScreen.Play("ÉPÉE DE LÉGENDE");

                ctx.ShowToast("LA LAME S'ÉVEILLE…", ConsoleColor.Black, ConsoleColor.DarkRed, durationTicks: 10);
                ctx.PushLog("Tu arraches la lame du socle. Le temple gronde.", GameContext.LogKind.System);

                Map3Scripting.TriggerLegendarySwordEvent(ctx, fromPos: prev);
            }
        }

        // ===== Exit =====
        if (ctx.Map.GetTile(next) == TileType.Exit)
        {
            if (ctx.CurrentLevel == 1 && !HasAnyWeapon(ctx.Player))
            {
                ctx.PushLog("Sentinelle : Reviens quand tu seras armé.", GameContext.LogKind.Warning);
                ctx.Player.SetPosition(prev);
                ctx.UpdateVision();
                return;
            }

            int nextLevel = ctx.CurrentLevel + 1;

            if (!LevelCatalog.HasLevel(nextLevel))
            {
                ctx.State = new EndState(victory: true);
                return;
            }

            if (ctx.CurrentLevel == 3 && nextLevel == 4)
            {
                ctx.PushLog("La dernière porte s'ouvre…", GameContext.LogKind.System);
                BossIntroScreen.Play(ctx.Player, bossName: "Roi de l'Abîme");
            }

            ctx.PushLog($"Vous passez la sortie... (Niveau {nextLevel})", GameContext.LogKind.System);
            ctx.LoadLevel(nextLevel);
            ctx.State = new ExplorationState();
            return;
        }

        ctx.UpdateVision();
        ctx.AdvanceTimeAfterPlayerMove();
        MonstersTurn(ctx);
    }

    private static void MonstersTurn(GameContext ctx)
    {
        foreach (var m in ctx.Monsters.Where(m => !m.IsDead))
        {
            int dist = Math.Abs(m.Pos.X - ctx.Player.Pos.X) + Math.Abs(m.Pos.Y - ctx.Player.Pos.Y);
            if (dist <= 1) continue;

            var dir = m.MoveStrategy.ChooseMove(m, ctx);
            if (dir == Direction.None) continue;

            var next = m.Pos.Move(dir);
            if (!ctx.Map.IsWalkable(next)) continue;
            if (ctx.MonsterAt(next) is not null) continue;
            if (next == ctx.Player.Pos) continue;

            m.SetPosition(next);
        }
    }

    private static bool TryMoveGuardAside(GameContext ctx, Pnj guard, Position playerFrom)
    {
        var candidates = new[]
        {
            playerFrom,
            guard.Pos.Move(Direction.Up),
            guard.Pos.Move(Direction.Down),
            guard.Pos.Move(Direction.Left),
            guard.Pos.Move(Direction.Right),
        };

        foreach (var p in candidates)
        {
            if (!ctx.Map.InBounds(p)) continue;
            if (!ctx.Map.IsWalkable(p)) continue;
            if (p == ctx.Player.Pos) continue;
            if (ctx.MonsterAt(p) is not null) continue;
            if (ctx.PnjAt(p) is not null) continue;

            guard.SetPosition(p);
            return true;
        }

        return false;
    }

    private static bool HasAnyWeapon(Player p)
    {
        if (p.EquippedWeapon is IEquipable eqW && eqW.Slot == EquipSlot.Weapon)
            return true;

        return p.Inventory.Any(i => i is IEquipable eq && eq.Slot == EquipSlot.Weapon);
    }

    private static bool HasItem<T>(Player p) where T : Item
        => p.Inventory.Any(i => i is T);

    private static void RemoveFirstItem<T>(Player p) where T : Item
    {
        var it = p.Inventory.FirstOrDefault(i => i is T);
        if (it is not null) p.RemoveFromInventory(it);
    }
}