namespace RogueLike.App.Services;

using RogueLike.App;
using RogueLike.App.Infrastructure.Events;
using RogueLike.Domain;
using RogueLike.Domain.Entities;
using RogueLike.Domain.Items;
using static RogueLike.Domain.Entities.Chest;

public sealed class ItemService
{
    public bool TryPickup(GameContext ctx, Position at)
    {
        var item = ctx.ItemAt(at);
        if (item is null) return false;

        ctx.RemoveItem(item);

        if (item.AutoApplyOnPickup)
        {
            item.Apply(ctx.Player);
            ctx.PushLog($"Vous ramassez {item.Name} (utilisé).", GameContext.LogKind.Loot);
        }
        else
        {
            ctx.Player.AddToInventory(item);

            if (item.AutoEquipOnPickup)
            {
                ctx.Player.Equip(item);
                ctx.PushLog($"{item.Name} est équipée automatiquement.", GameContext.LogKind.System);
            }
            else
            {
                ctx.PushLog($"Vous ramassez {item.Name} (inventaire).", GameContext.LogKind.Loot);
            }
        }

        ctx.Events.Publish(new ItemPickedEvent(item.Name));
        return true;
    }

    public void OpenChest(GameContext ctx, Chest chest)
    {
        if (chest.IsOpened) return;

        chest.Open();

        var loot = chest.Type switch
        {
            ChestType.TorchOnly => LootTable.RollTorch(chest.Pos),
            ChestType.Legendary => LootTable.Roll(ctx.Rng, chest.Pos),
            _ => LootTable.Roll(ctx.Rng, chest.Pos)
        };

        string chestLabel = chest.Type switch
        {
            ChestType.TorchOnly => "coffre de torche",
            ChestType.Legendary => "COFFRE LÉGENDAIRE",
            _ => "coffre"
        };

        if (loot.AutoApplyOnPickup)
        {
            loot.Apply(ctx.Player);
            ctx.AddMessage($"Vous ouvrez un {chestLabel} ! Vous trouvez {loot.Name} (utilisé).");
        }
        else
        {
            ctx.Player.AddToInventory(loot);
            ctx.AddMessage($"Vous ouvrez un {chestLabel} ! Vous trouvez {loot.Name} (inventaire).");
        }

        ctx.Events.Publish(new ChestOpenedEvent(chestLabel, loot.Name));
    }
}
