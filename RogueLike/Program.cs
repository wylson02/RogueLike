using RogueLike.App;
using RogueLike.App.States;
using RogueLike.Domain;
using RogueLike.Domain.Entities;
using RogueLike.UI;

Console.Clear();

GameMap map = BuildMap1();
var ctx = new GameContext(map, new Player(new Position(1, 1)));

IGameState state = new ExplorationState();

while (true)
{
    ConsoleRenderer.Draw(ctx, state.Name);
    state.Update(ctx);
}

static GameMap BuildMap1()
{
    string[] raw =
    {
        "####################",
        "#..................E",
        "#..####............#",
        "#..#...............#",
        "#..#....######.....#",
        "#..#...............#",
        "#..##########......#",
        "#..................#",
        "####################"
    };

    int h = raw.Length;
    int w = raw[0].Length;

    var tiles = new TileType[h, w];

    for (int y = 0; y < h; y++)
        for (int x = 0; x < w; x++)
        {
            char c = raw[y][x];
            tiles[y, x] = c switch
            {
                '#' => TileType.Wall,
                'E' => TileType.Exit,
                _ => TileType.Floor
            };
        }

    return new GameMap(tiles);
}
