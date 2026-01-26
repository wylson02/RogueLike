namespace RogueLike.App;

public sealed class TimeSystem
{
    public int Tick { get; private set; }

    public int PhaseLength { get; }

    public bool IsNight { get; private set; } = false;

    public TimeSystem(int phaseLength = 20)
    {
        PhaseLength = Math.Max(4, phaseLength);
    }
 
    public double Progress01
        => (Tick % PhaseLength) / (double)PhaseLength;

    public int TickInPhase
        => Tick % PhaseLength;

    public bool Advance()
    {
        Tick++;

        if (Tick % PhaseLength == 0)
        {
            IsNight = !IsNight;
            return true;
        }

        return false;
    }
}
