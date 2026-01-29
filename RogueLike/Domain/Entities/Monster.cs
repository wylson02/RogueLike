namespace RogueLike.Domain.Entities;

using RogueLike.Domain;
using RogueLike.Domain.AI;

public sealed class Monster : Character
{
    public override char Glyph => 'M';
    public string Name { get; }
    public IMoveStrategy MoveStrategy { get; }

    public MonsterRank Rank { get; }

    public int MinGoldReward { get; }
    public int MaxGoldReward { get; }
    public int MinXpReward { get; }
    public int MaxXpReward { get; }

    public Monster(
        string name,
        Position pos,
        int hp,
        int attack,
        IMoveStrategy strategy,
        int minGoldReward,
        int maxGoldReward,
        int minXpReward,
        int maxXpReward,
        MonsterRank rank = MonsterRank.Normal)
        : base(pos, hp, attack)
    {
        Name = name;
        MoveStrategy = strategy;
        Rank = rank;

        if (maxGoldReward < minGoldReward)
            (minGoldReward, maxGoldReward) = (maxGoldReward, minGoldReward);

        MinGoldReward = Math.Max(0, minGoldReward);
        MaxGoldReward = Math.Max(0, maxGoldReward);

        if (maxXpReward < minXpReward)
            (minXpReward, maxXpReward) = (maxXpReward, minXpReward);

        MinXpReward = Math.Max(0, minXpReward);
        MaxXpReward = Math.Max(0, maxXpReward);
    }

    /// <summary>
    /// Roll inclusif : [Min..Max]
    /// </summary>
    public int RollGold(Random rng)
    {
        if (MinGoldReward == MaxGoldReward) return MinGoldReward;
        return rng.Next(MinGoldReward, MaxGoldReward + 1);
    }

    /// <summary>
    /// Roll inclusif : [Min..Max]
    /// </summary>
    public int RollXp(Random rng)
    {
        if (MinXpReward == MaxXpReward) return MinXpReward;
        return rng.Next(MinXpReward, MaxXpReward + 1);
    }
}
