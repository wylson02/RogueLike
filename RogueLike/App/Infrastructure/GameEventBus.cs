namespace RogueLike.App.Infrastructure;

/// <summary>
/// Event bus synchrone ultra-léger. La UI peut s'abonner pour réagir (animations, sons, etc.).
/// </summary>
public sealed class GameEventBus
{
    private readonly Dictionary<Type, List<Delegate>> _handlers = new();

    public void Subscribe<T>(Action<T> handler) where T : IGameEvent
    {
        var t = typeof(T);
        if (!_handlers.TryGetValue(t, out var list))
        {
            list = new List<Delegate>();
            _handlers[t] = list;
        }
        list.Add(handler);
    }

    public void Publish<T>(T evt) where T : IGameEvent
    {
        var t = typeof(T);
        if (!_handlers.TryGetValue(t, out var list)) return;
        foreach (var d in list.ToArray())
            ((Action<T>)d)(evt);
    }
}
