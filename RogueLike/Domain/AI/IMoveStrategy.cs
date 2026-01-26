namespace RogueLike.Domain.AI;

using RogueLike.App;
using RogueLike.Domain;
using RogueLike.Domain.Entities;

public interface IMoveStrategy
{
    Direction ChooseMove(Monster m, GameContext ctx);
}
