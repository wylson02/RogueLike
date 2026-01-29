namespace RogueLike.App.States;

using System.Linq;
using RogueLike.App;
using RogueLike.App.Services;
using RogueLike.Domain;
using RogueLike.UI;

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
        if (!ctx.Map.IsWalkable(next)) return;

        // Porte fermée (tile DoorClosed)
        if (ctx.IsDoorClosed(next))
        {
            ctx.PushLog("La porte est scellée.", GameContext.LogKind.Warning);
            return;
        }

        // Sceau (Map 3)
        var seal = ctx.SealAt(next);
        if (seal is not null)
        {
            ctx.Player.SetPosition(next);
            seal.Activate();
            ctx.IncrementSealsActivated();
            ctx.PushLog($"Sceau {seal.Id} activé ({ctx.SealsActivated}/3).", GameContext.LogKind.System);

            // 3/3 => ouvrir l'accès à la salle centrale
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

        // Combat
        var enemy = ctx.MonsterAt(next);
        if (enemy is not null)
        {
            ctx.State = new CombatState(enemy);
            return;
        }

        // Déplacement normal
        ctx.Player.SetPosition(next);

        // Pickup item au sol
        var item = ctx.ItemAt(next);
        if (item is not null)
        {
            ctx.RemoveItem(item);

            if (item.AutoApplyOnPickup)
            {
                item.Apply(ctx.Player);
                ctx.PushLog($"Vous ramassez {item.Name} (utilisé).", GameContext.LogKind.Loot);
            }
            else
            {
                ctx.Player.AddToInventory(item);
                ctx.PushLog($"Vous ramassez {item.Name} (inventaire).", GameContext.LogKind.Loot);
            }

            // Script Map 3 : épée de légende
            if (ctx.CurrentLevel == 3 && item is RogueLike.Domain.Items.LegendarySwordItem)
            {
                ctx.MarkLegendarySwordPicked();
                Map3Scripting.TriggerLegendarySwordEvent(ctx, fromPos: prev);
            }
        }

        // Exit (changement de niveau)
        if (ctx.Map.GetTile(next) == TileType.Exit)
        {
            ctx.PushLog("Vous passez la sortie...", GameContext.LogKind.System);
            ctx.LoadLevel(ctx.CurrentLevel + 1);
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
