using System;
using System.Collections.Generic;
using System.Text;

namespace RogueLike.UI;

using global::RogueLike.Domain;
using RogueLike.Domain;

public static class ConsoleInput
{
    public static Direction ReadDirection()
    {
        var key = Console.ReadKey(true).Key;

        return key switch
        {
            ConsoleKey.UpArrow => Direction.Up,
            ConsoleKey.DownArrow => Direction.Down,
            ConsoleKey.LeftArrow => Direction.Left,
            ConsoleKey.RightArrow => Direction.Right,

            ConsoleKey.Z => Direction.Up,
            ConsoleKey.S => Direction.Down,
            ConsoleKey.Q => Direction.Left,
            ConsoleKey.D => Direction.Right,

            _ => Direction.None
        };
    }
}

