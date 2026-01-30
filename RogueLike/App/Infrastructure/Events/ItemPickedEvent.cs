namespace RogueLike.App.Infrastructure.Events;

using RogueLike.App.Infrastructure;

public sealed record ItemPickedEvent(string ItemName) : IGameEvent;
