namespace RogueLike.App.Infrastructure.Events;

using RogueLike.App.Infrastructure;

public sealed record ChestOpenedEvent(string ChestLabel, string ItemName) : IGameEvent;
