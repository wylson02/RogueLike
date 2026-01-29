namespace RogueLike.App.States;

using RogueLike.App;
using RogueLike.Domain.Items;
using RogueLike.Domain.Entities;
using RogueLike.Domain;

/// <summary>
/// Interface simple d'achat/vente en console.
/// (Ajout progressif : minimal, sans casser l'HUD.)
/// </summary>
public sealed class MerchantState : IGameState
{
    public string Name => "Marchand";

    private readonly IGameState _previous;
    private readonly Merchant _merchant;

    private sealed record StockLine(string Label, Func<Item> CreateItem, int Price);

    private readonly List<StockLine> _stock;

    public MerchantState(IGameState previous, Merchant merchant)
    {
        _previous = previous;
        _merchant = merchant;

        // Stock fixe (facile à équilibrer plus tard)
        _stock = new()
        {
            new StockLine("Épée (+ATK)", () => new SwordItem(new Position(-1,-1)), 18),
            new StockLine("Armure (+ARM)", () => new ArmorItem(new Position(-1,-1)), 20),
            new StockLine("Gemme de vie (+PV max)", () => new LifeGemItem(new Position(-1,-1)), 22),
            new StockLine("Charme critique (+CRIT)", () => new CritCharmItem(new Position(-1,-1)), 24),
            new StockLine("Anneau vampirique (+VOL)", () => new VampRingItem(new Position(-1,-1)), 26),
        };
    }

    public void Update(GameContext ctx)
    {
        Console.SetCursorPosition(0, 0);
        Console.Clear();
        Console.CursorVisible = false;

        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine($"== {_merchant.Name} ==");
        Console.ResetColor();
        Console.WriteLine("(B) Acheter   (V) Vendre   (Échap) Retour");
        Console.WriteLine($"Or : {ctx.Player.Gold}");
        Console.WriteLine();

        var key = Console.ReadKey(true).Key;

        if (key == ConsoleKey.Escape)
        {
            ctx.State = _previous;
            return;
        }

        if (key == ConsoleKey.B)
        {
            BuyFlow(ctx);
            return;
        }

        if (key == ConsoleKey.V)
        {
            SellFlow(ctx);
            return;
        }
    }

    private void BuyFlow(GameContext ctx)
    {
        while (true)
        {
            Console.Clear();
            Console.WriteLine($"== Acheter chez {_merchant.Name} ==   Or: {ctx.Player.Gold}");
            Console.WriteLine("Choisissez un objet (1-9) ou Échap pour revenir.");
            Console.WriteLine();

            for (int i = 0; i < _stock.Count; i++)
                Console.WriteLine($"{i + 1}. {_stock[i].Label}  -  {_stock[i].Price} gold");

            var k = Console.ReadKey(true).Key;
            if (k == ConsoleKey.Escape) return;

            int idx = KeyToIndex(k);
            if (idx < 0 || idx >= _stock.Count) continue;

            var line = _stock[idx];
            if (ctx.Player.Gold < line.Price)
            {
                ctx.PushLog("Pas assez d'or.", GameContext.LogKind.Warning);
                return;
            }

            ctx.Player.SpendGold(line.Price);
            var item = line.CreateItem();
            ctx.Player.AddToInventory(item);
            ctx.PushLog($"Achat : {item.Name} (-{line.Price} gold).", GameContext.LogKind.Loot);
            return;
        }
    }

    private void SellFlow(GameContext ctx)
    {
        while (true)
        {
            Console.Clear();
            Console.WriteLine($"== Vendre à {_merchant.Name} ==   Or: {ctx.Player.Gold}");
            Console.WriteLine("Choisissez un objet (1-9) ou Échap pour revenir.");
            Console.WriteLine();

            var inv = ctx.Player.Inventory;
            if (inv.Count == 0)
            {
                Console.WriteLine("Inventaire vide.");
                Console.ReadKey(true);
                return;
            }

            int shown = Math.Min(9, inv.Count);
            for (int i = 0; i < shown; i++)
            {
                var it = inv[i];
                int price = SellPrice(it);
                Console.WriteLine($"{i + 1}. {it.Name}  ->  +{price} gold");
            }

            var k = Console.ReadKey(true).Key;
            if (k == ConsoleKey.Escape) return;

            int idx = KeyToIndex(k);
            if (idx < 0 || idx >= shown) continue;

            var item = inv[idx];
            int p = SellPrice(item);

            ctx.Player.RemoveFromInventory(item);
            ctx.Player.AddGold(p);
            ctx.PushLog($"Vente : {item.Name} (+{p} gold).", GameContext.LogKind.Loot);
            return;
        }
    }

    private static int KeyToIndex(ConsoleKey k)
        => k switch
        {
            ConsoleKey.D1 or ConsoleKey.NumPad1 => 0,
            ConsoleKey.D2 or ConsoleKey.NumPad2 => 1,
            ConsoleKey.D3 or ConsoleKey.NumPad3 => 2,
            ConsoleKey.D4 or ConsoleKey.NumPad4 => 3,
            ConsoleKey.D5 or ConsoleKey.NumPad5 => 4,
            ConsoleKey.D6 or ConsoleKey.NumPad6 => 5,
            ConsoleKey.D7 or ConsoleKey.NumPad7 => 6,
            ConsoleKey.D8 or ConsoleKey.NumPad8 => 7,
            ConsoleKey.D9 or ConsoleKey.NumPad9 => 8,
            _ => -1
        };

    private static int SellPrice(Item item)
    {
        // Prix simple : basé sur le type (peut évoluer vers rareté + loot pondéré)
        return item switch
        {
            LegendarySwordItem => 50,
            VampRingItem => 13,
            CritCharmItem => 12,
            LifeGemItem => 11,
            ArmorItem => 10,
            SwordItem => 9,
            _ => 6
        };
    }
}
