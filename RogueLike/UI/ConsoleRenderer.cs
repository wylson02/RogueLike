using System;
using System.Collections.Generic;
using System.Text;

namespace RogueLike.UI;

using RogueLike.App;
using RogueLike.Domain;

public static class ConsoleRenderer
{
    public static void Draw(GameContext ctx, string stateName)
    {
        Console.CursorVisible = false;
        Console.SetCursorPosition(0, 0);

        for (int y = 0; y < ctx.Map.Height; y++)
        {
            for (int x = 0; x < ctx.Map.Width; x++)
            {
                var p = new Position(x, y);

                char c = ctx.Map.GetTile(p) switch
                {
                    TileType.Wall => '#',
                    TileType.Exit => 'E',
                    _ => '.'
                };

                if (ctx.Player.Pos == p)
                    c = '@';

                Console.Write(c);
            }
            Console.WriteLine();
        }

        Console.WriteLine(
            $"State: {stateName} | PV: {ctx.Player.Hp}/{ctx.Player.MaxHp} | ATK: {ctx.Player.Attack}"
        );
        Console.WriteLine("Flèches ou ZQSD pour bouger.");
    }
}

