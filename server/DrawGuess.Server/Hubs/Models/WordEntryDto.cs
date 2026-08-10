namespace DrawGuess.Server.Hubs.Models;

public sealed record WordEntryDto(string Word, IReadOnlyList<string> Aliases);
