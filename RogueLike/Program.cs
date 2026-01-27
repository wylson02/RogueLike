using RogueLike.App;
using RogueLike.App.States;
using RogueLike.Domain;
using RogueLike.Domain.AI;
using RogueLike.Domain.Entities;
using RogueLike.UI;
using RogueLike.Domain.Items;

Console.Clear();

GameMap map = BuildMap1();

var ctx = new GameContext(
    map,
    new Player(new Position(1, 1)),
    new ExplorationState()
);

// Monstres
ctx.Monsters.Add(new Monster("Slime", new Position(10, 3), 6, 5, new AggroWithinRangeStrategy(range: 3)));
ctx.Monsters.Add(new Monster("Golem", new Position(14, 6), 20, 1, new AggroWithinRangeStrategy(range: 3)));
ctx.Items.Add(new LifeGemItem(new Position(2, 1)));
ctx.Items.Add(new ArmorItem(new Position(5, 5)));
ctx.Items.Add(new SwordItem(new Position(9, 7)));

while (true)
{
    ConsoleRenderer.Draw(ctx, ctx.State.Name);
    ctx.State.Update(ctx);
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
