using DrawGuess.Server.Hubs.Models;
using DrawGuess.Server.Models;

namespace DrawGuess.Server.Services;

public static class GameEngine
{
    public const int MaxNameLength = 20;
    public const int MaxClientIdLength = 64;
    public const int MaxChatLength = 100;
    public const int MaxHintLength = 50;
    public const int MaxStrokeIdLength = 40;
    public const int MaxColorLength = 32;
    public const int MaxWordLength = 20;
    public const int MaxAliasesPerWord = 10;
    public const int MaxAliasLength = 20;
    public const int MaxWordBankSize = 2000;

    public static string? ValidatePlayerName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return "昵称不能为空";
        }

        var trimmed = name.Trim();
        return trimmed.Length is > 0 and <= MaxNameLength ? null : $"昵称长度需在 1-{MaxNameLength} 个字符之间";
    }

    public static string? ValidateClientId(string? clientId)
    {
        return string.IsNullOrWhiteSpace(clientId) || clientId.Length > MaxClientIdLength
            ? "客户端标识无效"
            : null;
    }

    public static string? ValidateChatText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        return text.Trim().Length <= MaxChatLength ? null : $"消息过长（最多 {MaxChatLength} 字符）";
    }

    public static string? ValidateHintText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return "提示内容不能为空";
        }

        return text.Trim().Length <= MaxHintLength ? null : $"提示过长（最多 {MaxHintLength} 字符）";
    }

    public static bool MatchesWord(WordEntry entry, string guess)
    {
        var normalized = guess.Trim();
        if (string.Equals(normalized, entry.Word, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return entry.Aliases.Any(alias => string.Equals(normalized, alias, StringComparison.OrdinalIgnoreCase));
    }

    public static int RequiredKickVotes(int playerCount)
    {
        return Math.Max(2, playerCount / 2 + 1);
    }

    public static int DecreasingScore(TimeSpan total, TimeSpan remaining)
    {
        if (total <= TimeSpan.Zero)
        {
            return 100;
        }

        var ratio = Math.Clamp(remaining.TotalSeconds / total.TotalSeconds, 0, 1);
        return Math.Max(1, (int)Math.Floor(100 * ratio));
    }

    public static int? NextDrawerIndex(
        IReadOnlyList<string> drawerOrder,
        string? currentDrawerId,
        Func<string, bool> playerExists)
    {
        if (drawerOrder.Count == 0)
        {
            return null;
        }

        if (currentDrawerId is null)
        {
            for (var i = 0; i < drawerOrder.Count; i++)
            {
                if (playerExists(drawerOrder[i]))
                {
                    return i;
                }
            }

            return null;
        }

        var currentIndex = -1;
        for (var i = 0; i < drawerOrder.Count; i++)
        {
            if (drawerOrder[i] == currentDrawerId)
            {
                currentIndex = i;
                break;
            }
        }

        if (currentIndex < 0)
        {
            for (var i = 0; i < drawerOrder.Count; i++)
            {
                if (playerExists(drawerOrder[i]))
                {
                    return i;
                }
            }

            return null;
        }

        var existingCount = drawerOrder.Count(playerExists);
        if (existingCount <= 1)
        {
            return currentIndex;
        }

        for (var step = 1; step <= drawerOrder.Count; step++)
        {
            var candidate = (currentIndex + step) % drawerOrder.Count;
            if (playerExists(drawerOrder[candidate]))
            {
                return candidate;
            }
        }

        return currentIndex;
    }

    public static (bool Valid, string? Error) ValidateSettings(RoomSettingsDto? settings)
    {
        if (settings is null)
        {
            return (false, "设置不能为空");
        }

        if (settings.TotalRounds is < RoomSettings.MinTotalRounds or > RoomSettings.MaxTotalRounds)
        {
            return (false, $"轮数需在 {RoomSettings.MinTotalRounds}-{RoomSettings.MaxTotalRounds} 之间");
        }

        if (settings.RoundDurationSeconds is < RoomSettings.MinRoundDurationSeconds or > RoomSettings.MaxRoundDurationSeconds)
        {
            return (false, $"每轮时间需在 {RoomSettings.MinRoundDurationSeconds}-{RoomSettings.MaxRoundDurationSeconds} 秒之间");
        }

        if (settings.ScoreMode is not ("Preemptive" or "Decreasing"))
        {
            return (false, "未知的游戏模式");
        }

        return (true, null);
    }

    public static RoomSettings ToSettings(RoomSettingsDto settings)
    {
        return new RoomSettings
        {
            TotalRounds = settings.TotalRounds,
            RoundDurationSeconds = settings.RoundDurationSeconds,
            ScoreMode = settings.ScoreMode == "Decreasing" ? ScoreMode.Decreasing : ScoreMode.Preemptive
        };
    }

    public static (bool Valid, string? Error) ValidateWordBank(IReadOnlyList<WordEntryDto>? words)
    {
        if (words is null || words.Count == 0)
        {
            return (false, "词库不能为空");
        }

        if (words.Count > MaxWordBankSize)
        {
            return (false, $"词库过大，最多支持 {MaxWordBankSize} 个词");
        }

        for (var i = 0; i < words.Count; i++)
        {
            var word = words[i].Word?.Trim();
            if (string.IsNullOrEmpty(word))
            {
                return (false, $"第 {i + 1} 行：词不能为空");
            }

            if (word.Length > MaxWordLength)
            {
                return (false, $"第 {i + 1} 行：词过长（最多 {MaxWordLength} 个字符）");
            }

            var aliases = words[i].Aliases?.Where(a => !string.IsNullOrWhiteSpace(a)).Select(a => a.Trim()).ToList() ?? [];
            if (aliases.Count > MaxAliasesPerWord)
            {
                return (false, $"第 {i + 1} 行：别名过多（最多 {MaxAliasesPerWord} 个）");
            }

            if (aliases.Any(a => a.Length > MaxAliasLength))
            {
                return (false, $"第 {i + 1} 行：别名过长（最多 {MaxAliasLength} 个字符）");
            }
        }

        return (true, null);
    }

    public static (bool Valid, string? Error) ValidateDrawAction(DrawActionDto action)
    {
        if (action.Type is not ("begin" or "draw" or "end"))
        {
            return (false, "无效的画笔动作");
        }

        if (string.IsNullOrEmpty(action.StrokeId) || action.StrokeId.Length > MaxStrokeIdLength)
        {
            return (false, "无效的笔画标识");
        }

        if (!float.IsFinite(action.X) || !float.IsFinite(action.Y) ||
            action.X is < -1f or > 2f || action.Y is < -1f or > 2f)
        {
            return (false, "无效的坐标");
        }

        if (string.IsNullOrEmpty(action.Color) || action.Color.Length > MaxColorLength)
        {
            return (false, "无效的颜色");
        }

        if (action.Size is < 1 or > 80)
        {
            return (false, "无效的笔刷大小");
        }

        return (true, null);
    }
}
