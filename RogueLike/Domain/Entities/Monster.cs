namespace RogueLike.Domain.Entities;

using RogueLike.Domain;
using RogueLike.Domain.AI;

public sealed class Monster : Character
{
    public override char Glyph => 'M';
    public string Name { get; }
    public IMoveStrategy MoveStrategy { get; }

    public int MinGoldReward { get; }
    public int MaxGoldReward { get; }

    public Monster(
        string name,
        Position pos,
        int hp,
        int attack,
        IMoveStrategy strategy,
        int minGoldReward,
        int maxGoldReward)
        : base(pos, hp, attack)
    {
        Name = name;
        MoveStrategy = strategy;

        if (maxGoldReward < minGoldReward)
            (minGoldReward, maxGoldReward) = (maxGoldReward, minGoldReward);

        MinGoldReward = Math.Max(0, minGoldReward);
        MaxGoldReward = Math.Max(0, maxGoldReward);
    }

    /// <summary>
    /// Roll inclusif : [Min..Max]
    /// </summary>
    public int RollGold(Random rng)
    {
        if (MinGoldReward == MaxGoldReward) return MinGoldReward;
        return rng.Next(MinGoldReward, MaxGoldReward + 1);
    }
}
