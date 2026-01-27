using RogueLike.Domain.Entities;

public sealed class Map1ArmorKey : KeyQuest
{
    public Map1ArmorKey(Entity owner)
        : base("Clé du Coffre d'Armure", KeyQuestType.Map1_ArmorDoor, owner)
    {
    }
}