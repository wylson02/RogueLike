namespace RogueLike.App.Infrastructure.Events;

using RogueLike.App.Infrastructure;

public sealed record LogPushedEvent(string Kind, string Text) : IGameEvent;
