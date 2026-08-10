namespace DrawGuess.Server.Models;

public sealed class WordEntry
{
    public required string Word { get; init; }
    public IReadOnlyList<string> Aliases { get; init; } = [];
}
