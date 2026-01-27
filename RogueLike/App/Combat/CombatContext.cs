namespace RogueLike.App.Combat;

using RogueLike.Domain.Entities;

public sealed class CombatContext
{
    public Player Player { get; }
    public Monster Enemy { get; }
    public Random Rng { get; }

    public List<string> Log { get; } = new();

    public int HealsLeft { get; private set; } = 2;
    public int HealAmount { get; } = 8;

    public int DodgeTurnsLeft { get; private set; } = 0;
    public int DodgeChancePercent { get; } = 40;

    public int FleeChancePercent { get; } = 55;

    public bool IsOver => Player.IsDead || Enemy.IsDead;
    public bool PlayerFled { get; private set; }

    public CombatContext(Player player, Monster enemy, Random rng)
    {
        Player = player;
        Enemy = enemy;
        Rng = rng;
    }

    public void AddLog(string msg) => Log.Add(msg);

    public bool Roll(int chancePercent) => Rng.Next(0, 100) < chancePercent;

    public void ConsumeHealCharge() => HealsLeft = Math.Max(0, HealsLeft - 1);

    public void ActivateDodgeBuff(int turns) => DodgeTurnsLeft = Math.Max(DodgeTurnsLeft, turns);

    public void TickEndOfRound()
    {
        if (DodgeTurnsLeft > 0)
            DodgeTurnsLeft--;
    }

    public void SetFled()
    {
        PlayerFled = true;
    }
}
