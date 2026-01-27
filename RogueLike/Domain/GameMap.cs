using System;
using System.Collections.Generic;
using System.Text;

namespace RogueLike.Domain;

public sealed class GameMap
{
    private readonly TileType[,] _tiles;

    public int Width { get; }
    public int Height { get; }

    public GameMap(TileType[,] tiles)
    {
        _tiles = tiles;
        Height = tiles.GetLength(0);
        Width = tiles.GetLength(1);
    }

    public static GameMap BuildFromRaw(string[] raw)
    {
        if (raw == null || raw.Length == 0)
            throw new ArgumentException("Raw map cannot be null or empty.");

        int height = raw.Length;
        int width = raw[0].Length;

        var tiles = new TileType[height, width];

        for (int y = 0; y < height; y++)
        {
            if (raw[y].Length != width)
                throw new ArgumentException("All map rows must have the same width.");

            for (int x = 0; x < width; x++)
            {
                char c = raw[y][x];

                tiles[y, x] = c switch
                {
                    '#' => TileType.Wall,
                    '.' => TileType.Floor,
                    'E' => TileType.Exit,
                    _ => TileType.Floor, 
                };
            }
        }

        return new GameMap(tiles);
    }

    public bool InBounds(Position p)
        => p.X >= 0 && p.Y >= 0 && p.X < Width && p.Y < Height;

    public TileType GetTile(Position p)
        => _tiles[p.Y, p.X];

    public bool IsWalkable(Position p)
    {
        if (!InBounds(p)) return false;

        var t = GetTile(p);
        return t == TileType.Floor || t == TileType.Exit;
    }
}
