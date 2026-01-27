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

    public MonsterBuilder Named(string name) { _name = name; return this; }
    public MonsterBuilder At(Position pos) { _pos = pos; return this; }
    public MonsterBuilder WithHp(int hp) { _hp = hp; return this; }
    public MonsterBuilder WithAttack(int atk) { _atk = atk; return this; }
    public MonsterBuilder WithAi(IMoveStrategy ai) { _ai = ai; return this; }

    public Monster Build() => new Monster(_name, _pos, _hp, _atk, _ai);
}
