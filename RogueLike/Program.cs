using RogueLike.App;
using RogueLike.App.Services;
using RogueLike.App.States;
using RogueLike.Domain.Entities;
using RogueLike.UI;

Console.Clear();

var level = LevelCatalog.CreateLevel1();

var ctx = new GameContext(
    level.Map,
    new Player(level.PlayerStart),
    new ExplorationState()
);

ctx.UpdateVision(); //initialiser la vision
ctx.Monsters.AddRange(level.Monsters);
ctx.GameItems.AddRange(level.Items);
ctx.Chests.AddRange(level.Chests);
ctx.Seals.AddRange(level.Seals);
ctx.Merchant = level.Merchant;
ctx.SetLevelIndex(1);

while (true)
{
    ConsoleRenderer.Draw(ctx, ctx.State.Name);
    ctx.State.Update(ctx);
}
