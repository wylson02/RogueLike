namespace RogueLike.Domain.Builders;

using RogueLike.Domain.AI;
using RogueLike.Domain.Entities;

public sealed class MonsterBuilder
{
    private string _name = "Monster";
    private Position _pos = new Position(1, 1);
    private int _hp = 5;
    private int _atk = 1;
    private IMoveStrategy _ai = new RandomWalkStrategy();

    private int _goldMin = 0;
    private int _goldMax = 0;

    private int _xpMin = 1;
    private int _xpMax = 1;

    public MonsterBuilder Named(string name) { _name = name; return this; }
    public MonsterBuilder At(Position pos) { _pos = pos; return this; }
    public MonsterBuilder WithHp(int hp) { _hp = hp; return this; }
    public MonsterBuilder WithAttack(int atk) { _atk = atk; return this; }
    public MonsterBuilder WithAi(IMoveStrategy ai) { _ai = ai; return this; }

    public MonsterBuilder WithGoldReward(int min, int max)
    {
        _goldMin = min;
        _goldMax = max;
        return this;
    }

    public MonsterBuilder WithXpReward(int min, int max)
    {
        _xpMin = min;
        _xpMax = max;
        return this;
    }

    public Monster Build()
        => new Monster(_name, _pos, _hp, _atk, _ai, _goldMin, _goldMax, _xpMin, _xpMax);
}
