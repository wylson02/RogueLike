namespace RogueLike.Domain.Items.Quest;

using RogueLike.Domain.Entities;

public sealed class Map2ToMap3Key : KeyQuest
{
    public Map2ToMap3Key(Entity owner)
        : base("Rune du Sceau", KeyQuestType.Map2_ToMap3Door, owner)
    {
    }
}