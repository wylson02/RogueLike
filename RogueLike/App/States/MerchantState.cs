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
        DrawMerchantHeader(ctx);
        DrawMerchantStatsPanel(ctx);


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

            // Filtre : objets vendables uniquement
            var sellable = ctx.Player.Inventory
                .Where(it => it is not LegendarySwordItem)
                .ToList();

            if (sellable.Count == 0)
            {
                Console.WriteLine("Rien à vendre.");
                Console.ReadKey(true);
                return;
            }

            int shown = Math.Min(9, sellable.Count);
            for (int i = 0; i < shown; i++)
            {
                var it = sellable[i];
                int price = SellPrice(it);
                Console.WriteLine($"{i + 1}. {it.Name}  ->  +{price} gold");
            }

            var k = Console.ReadKey(true).Key;
            if (k == ConsoleKey.Escape) return;

            int idx = KeyToIndex(k);
            if (idx < 0 || idx >= shown) continue;

            var item = sellable[idx];
            int p = SellPrice(item);

            // On retire du vrai inventaire
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
    private static void DrawMerchantHeader(GameContext ctx)
    {
        string title = "MARCHAND";
        string line = $"Or : {ctx.Player.Gold}    B: Acheter   V: Vendre   Échap: Retour";

        int w = Math.Min(Console.WindowWidth - 1, Math.Max(44, Math.Max(title.Length + 6, line.Length + 4)));
        w = Math.Max(30, w);

        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine("┌" + new string('─', w - 2) + "┐");

        Console.Write("│ ");
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.Write(title);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine(new string(' ', Math.Max(0, w - 3 - title.Length)) + "│");

        Console.WriteLine("├" + new string('─', w - 2) + "┤");

        Console.Write("│ ");
        Console.ResetColor();
        string inner = line;
        if (inner.Length > w - 4) inner = inner[..(w - 5)] + "…";
        Console.Write(inner);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine(new string(' ', Math.Max(0, w - 3 - inner.Length)) + "│");

        Console.WriteLine("└" + new string('─', w - 2) + "┘");
        Console.ResetColor();
        Console.WriteLine();
    }

    private static void DrawMerchantStatsPanel(GameContext ctx)
    {
        int w = Math.Min(Console.WindowWidth - 1, 60);
        w = Math.Max(44, w);

        string l1 = $"Build : ATK {ctx.Player.Attack}  |  ARM {ctx.Player.Armor}  |  CRIT {ctx.Player.CritChancePercent}%  |  VOL {ctx.Player.LifeStealPercent}%";
        string l2 = $"Inventaire : {ctx.Player.Inventory.Count} objets   |   PV : {ctx.Player.Hp}/{ctx.Player.MaxHp}   |   Niveau : {ctx.Player.Level}";

        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine("╔" + new string('═', w - 2) + "╗");

        Console.Write("║ ");
        Console.ForegroundColor = ConsoleColor.Cyan;
        WriteFit(l1, w - 4);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine(" ║");

        Console.Write("║ ");
        Console.ForegroundColor = ConsoleColor.Gray;
        WriteFit(l2, w - 4);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine(" ║");

        Console.WriteLine("╚" + new string('═', w - 2) + "╝");
        Console.ResetColor();
        Console.WriteLine();
    }

    private static void WriteFit(string s, int w)
    {
        if (w <= 0) return;
        if (s.Length <= w) Console.Write(s.PadRight(w));
        else Console.Write(s[..(w - 1)] + "…");
    }



}
