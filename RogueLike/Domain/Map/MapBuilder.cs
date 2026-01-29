namespace RogueLike.Domain.Maps;

using RogueLike.Domain;

public sealed class MapBuilder
{
    private readonly TileType[,] _tiles;
    private readonly int _width;
    private readonly int _height;

    public MapBuilder(int width, int height)
    {
        _width = width;
        _height = height;
        _tiles = new TileType[height, width];

        Fill(TileType.Floor);
    }

    public MapBuilder Fill(TileType tile)
    {
        for (int y = 0; y < _height; y++)
            for (int x = 0; x < _width; x++)
                _tiles[y, x] = tile;

        return this;
    }

    public MapBuilder DrawBorder(TileType tile)
    {
        for (int x = 0; x < _width; x++)
        {
            _tiles[0, x] = tile;
            _tiles[_height - 1, x] = tile;
        }

        for (int y = 0; y < _height; y++)
        {
            _tiles[y, 0] = tile;
            _tiles[y, _width - 1] = tile;
        }

        return this;
    }

    public MapBuilder SetTile(int x, int y, TileType tile)
    {
        _tiles[y, x] = tile;
        return this;
    }

    public MapBuilder DrawRect(int startX, int startY, int w, int h, TileType tile)
    {
        for (int y = startY; y < startY + h; y++)
            for (int x = startX; x < startX + w; x++)
                _tiles[y, x] = tile;

        return this;
    }

    public GameMap Build()
        => new GameMap(_tiles);
}