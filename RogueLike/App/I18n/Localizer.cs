namespace RogueLike.App.I18n;

using System.Collections.Generic;

/// <summary>
/// i18n minimaliste : une table clé -> template. Suffit pour le projet console.
/// </summary>
public sealed class Localizer
{
    private readonly Dictionary<string, string> _strings;

    private Localizer(Dictionary<string, string> strings)
        => _strings = strings;

    public static Localizer CreateFrench()
        => new Localizer(new Dictionary<string, string>
        {
            ["level.loaded"] = "Niveau {level} chargé.",
        });

    public string T(string key, params (string name, string value)[] args)
    {
        if (!_strings.TryGetValue(key, out var tpl))
            tpl = key;

        foreach (var (name, value) in args)
            tpl = tpl.Replace("{" + name + "}", value);

        return tpl;
    }
}
