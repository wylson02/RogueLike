namespace RogueLike.Domain.Catalogs;

using RogueLike.Domain.AI;
using RogueLike.Domain.Builders;
using RogueLike.Domain.Entities;

public static class MonsterCatalog
{
    public static Monster Slime(Position pos)
        => new MonsterBuilder()
            .Named("Slime")
            .At(pos)
            .WithHp(6)
            .WithAttack(5)
            .WithGoldReward(min: 3, max: 7)
            .WithAi(new AggroWithinRangeStrategy(range: 3))
            .Build();

    public static Monster Golem(Position pos)
        => new MonsterBuilder()
            .Named("Golem")
            .At(pos)
            .WithHp(20)
            .WithAttack(1)
            .WithGoldReward(min: 10, max: 18)
            .WithAi(new AggroWithinRangeStrategy(range: 3))
            .Build();

    public static Monster NightSlime(Position pos)
        => new MonsterBuilder()
            .Named("Night Slime")
            .At(pos)
            .WithHp(6)
            .WithAttack(2)
            .WithGoldReward(min: 2, max: 5)
            .WithAi(new AggroWithinRangeStrategy(range: 3))
            .Build();
}
