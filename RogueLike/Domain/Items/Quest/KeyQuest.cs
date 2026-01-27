namespace RogueLike.Domain.Items;

using RogueLike.Domain.Entities;

public abstract class KeyQuest
{
    public string Name { get; }
    public KeyQuestType Type { get; }
    public Entity Owner { get; }
    public bool IsUsed { get; private set; }

    protected KeyQuest(string name, KeyQuestType type, Entity owner)
    {
        Name = name;
        Type = type;
        Owner = owner;
        IsUsed = false;
    }

    public void MarkUsed()
    {
        IsUsed = true;
    }
}