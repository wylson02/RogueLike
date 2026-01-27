namespace RogueLike.App.States;

using RogueLike.App;
using RogueLike.UI;

public sealed class InventoryState : IGameState
{
    public string Name => "Inventaire";

    private readonly IGameState _previous;
    private int _selectedIndex = 0;

    public InventoryState(IGameState previous)
    {
        _previous = previous;
    }

    public void Update(GameContext ctx)
    {
        var res = InventoryScreen.Show(ctx.Player, _selectedIndex);
        _selectedIndex = res.SelectedIndex;

        if (res.Action == InventoryAction.Close)
        {
            ctx.State = _previous;
            return;
        }

        if (res.Action == InventoryAction.UseSelected)
        {
            if (ctx.Player.Inventory.Count == 0)
                return;

            int idx = Math.Clamp(res.SelectedIndex, 0, ctx.Player.Inventory.Count - 1);
            var item = ctx.Player.Inventory[idx];

            ctx.Player.RemoveFromInventory(item);
            item.Apply(ctx.Player);

            ctx.AddMessage($"{item.Name} équipé/utilisé !");
        }

    }
}
