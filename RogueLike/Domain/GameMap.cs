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

