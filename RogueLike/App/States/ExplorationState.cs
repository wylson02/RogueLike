namespace RogueLike.App.States;

using RogueLike.App;
using RogueLike.App.Services;
using RogueLike.Domain;
using RogueLike.Domain.Entities;
using RogueLike.Domain.Items;
using RogueLike.UI;
using RogueLike.App.Services; 


using System.Linq;

public sealed class ExplorationState : IGameState
{
    public string Name => "Exploration";

    public void Update(GameContext ctx)
    {
        var cmd = ConsoleInput.ReadExplorationCommand();

        // DEV: jump direct level 3
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

        //ctx.PushLog($"DEBUG tile next = {ctx.Map.GetTile(next)}", GameContext.LogKind.System);

        //if (!ctx.Map.IsWalkable(next)) return;

        // Porte fermée
        if (ctx.IsDoorClosed(next))
        {
            ctx.PushLog("La porte est scellée.", GameContext.LogKind.Warning);
            return;
        }

            ctx.OpenDoor(next); // DoorClosed -> DoorOpen
            ctx.PushLog("🔓 Vous utilisez la clé. La porte s'ouvre.", GameContext.LogKind.System);

            // Optionnel : passer tout de suite après ouverture
            if (ctx.Map.IsWalkable(next))
            {
                ctx.Player.SetPosition(next);
                ctx.UpdateVision();
                ctx.AdvanceTimeAfterPlayerMove();
                MonstersTurn(ctx);
            }
            return;
        }

        // ✅ Maintenant seulement on bloque les murs, etc.
        if (!ctx.Map.IsWalkable(next)) return;

        //if (ctx.IsDoorClosed(next))
        //{
        //    ctx.PushLog("La porte est scellée.", GameContext.LogKind.Warning);
        //    return;
        //}

        // Sceau (Map 3)
        var seal = ctx.SealAt(next);
        if (seal is not null)
        {
            ctx.Player.SetPosition(next);
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

        // Marchand
        if (ctx.IsMerchantAt(next) && ctx.Merchant is not null)
        {
            ctx.Player.SetPosition(next);
            ctx.UpdateVision();
            ctx.State = new MerchantState(previous: this, ctx.Merchant);
            return;
        }

        // Coffre
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

        // Combat (SEULEMENT si le joueur marche sur la case du monstre ✅)
        var enemy = ctx.MonsterAt(next);
        if (enemy is not null)
        {
            ctx.State = new CombatState(enemy);
            return;
        }

        // Déplacement normal
        ctx.Player.SetPosition(next);

        var pnj = ctx.PnjAt(next);
        if (pnj is not null)
        {
            ctx.PushLog($"{pnj.Name} : {pnj.Talk()}", GameContext.LogKind.System);

            // ✅ CONDITION POUR WYLSON
            if (ctx.CurrentLevel == 1 && pnj.Name == "Wylson")
            {
                bool allMonstersDead = !ctx.Monsters.Any(m => !m.IsDead);

                if (!allMonstersDead)
                {
                    ctx.PushLog("Reviens quand t'auras tué tous les monstres.", GameContext.LogKind.Warning);
                    return;
                }
            }

            var giftName = pnj.GiveGift();
            if (giftName is not null)
            {
                var gift = ItemCatalog.Create(giftName, next);
                ctx.Player.AddToInventory(gift);
                ctx.PushLog($"Vous recevez : {gift.Name}", GameContext.LogKind.Loot);
            }
        }

        // PNJ talk
        //var pnj = ctx.PnjAt(next);
        //if (pnj is not null)
        //{
        //    ctx.PushLog($"{pnj.Name} : {pnj.Talk()}", GameContext.LogKind.System);

        //    var giftName = pnj.GiveGift();
        //    if (!string.IsNullOrWhiteSpace(giftName))
        //    {
        //        var gift = ItemCatalog.Create(giftName, next); // ✅ utilise l'id du PNJ
        //        ctx.Player.AddToInventory(gift);
        //        ctx.PushLog($"Vous recevez : {gift.Name}", GameContext.LogKind.Loot);
        //    }


        //    //var giftName = pnj.GiveGift();
        //    //if (giftName is not null)
        //    //{
        //    //    var gift = ItemCatalog.LifeGem(next);
        //    //    ctx.Player.AddToInventory(gift);
        //    //    ctx.PushLog($"Vous recevez : {gift.Name}", GameContext.LogKind.Loot);
        //    //}
        //}

        // Pick-up des items
        var item = ctx.ItemAt(next);
        if (item is not null)
        {
            bool picked = ctx.ItemService.TryPickup(ctx, next);
            if (!picked) return;

            if (ctx.CurrentLevel == 3 && item is LegendarySwordItem)
            {
                ctx.MarkLegendarySwordPicked();
                ctx.GrantLegendaryEmpower();

                // CINÉ FULLSCREEN
                LegendarySwordCinematicScreen.Play("ÉPÉE DE LÉGENDE");

                // petit rappel in-game (court)
                ctx.ShowToast("LA LAME S'ÉVEILLE…", ConsoleColor.Black, ConsoleColor.DarkRed, durationTicks: 10);
                ctx.PushLog("Tu arraches la lame du socle. Le temple gronde.", GameContext.LogKind.System);

                Map3Scripting.TriggerLegendarySwordEvent(ctx, fromPos: prev);
            }

        }

        // Exit (changement de niveau)
        if (ctx.Map.GetTile(next) == TileType.Exit)
        {
            int nextLevel = ctx.CurrentLevel + 1;

            if (!LevelCatalog.HasLevel(nextLevel))
            {
                ctx.State = new EndState(victory: true);
                return;
            }

            // Transition spéciale : Map 3 -> Boss final
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
}
