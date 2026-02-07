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
            .WithXpReward(min: 6, max: 10)
            .WithAi(new AggroWithinRangeStrategy(range: 3))
            .Build();

    public static Monster Golem(Position pos)
        => new MonsterBuilder()
            .Named("Golem")
            .At(pos)
            .WithHp(20)
            .WithAttack(1)
            .WithGoldReward(min: 10, max: 18)
            .WithXpReward(min: 6, max: 10)
            .WithAi(new AggroWithinRangeStrategy(range: 3))
            .Build();

    public static Monster NightSlime(Position pos)
        => new MonsterBuilder()
            .Named("Night Slime")
            .At(pos)
            .WithHp(6)
            .WithAttack(2)
            .WithGoldReward(min: 2, max: 5)
            .WithXpReward(min: 6, max: 10)
            .WithAi(new AggroWithinRangeStrategy(range: 3))
            .Build();

    public static Monster SealWardenMiniBoss(Position pos)
        => new MonsterBuilder()
            .Named("Gardien des Sceaux")
            .At(pos)
            .WithHp(32)
            .WithAttack(7)
            .WithGoldReward(min: 30, max: 55)
            .WithXpReward(min: 25, max: 40)
            .WithRank(MonsterRank.MiniBoss)
            .WithAi(new AggroWithinRangeStrategy(range: 6, fallback: new RandomWalkStrategy()))
            .Build();

    public static Monster SealWardenMiniBossEnraged(Position pos)
        => new MonsterBuilder()
            .Named("Gardien des Sceaux (ENRAGÉ)")
            .At(pos)
            .WithHp(44)
            .WithAttack(8)
            .WithGoldReward(min: 45, max: 80)
            .WithXpReward(min: 35, max: 55)
            .WithRank(MonsterRank.MiniBoss)
            .WithAi(new AggroWithinRangeStrategy(range: 7, fallback: new RandomWalkStrategy()))
            .Build();

    // ===================== FINAL BOSS =====================
    public static Monster AbyssKingBoss(Position pos)
    {
        var m = new MonsterBuilder()
            .Named("Roi de l'Abîme")
            .At(pos)
            .WithHp(95)
            .WithAttack(10)
            .WithGoldReward(min: 160, max: 220)
            .WithXpReward(min: 110, max: 160)
            .WithRank(MonsterRank.Boss)
            .WithAi(new AggroWithinRangeStrategy(range: 9, fallback: new RandomWalkStrategy()))
            .Build();

        // petit spice
        m.AddArmor(2);
        m.ModifyCritChance(12);
        m.ModifyCritMultiplierPercent(50);

        return m;
    }
}
