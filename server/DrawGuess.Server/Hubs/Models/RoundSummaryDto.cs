namespace DrawGuess.Server.Hubs.Models;

public sealed record RoundSummaryDto(
    int Round,
    string? Answer,
    IReadOnlyList<string> CorrectGuesserIds,
    IReadOnlyList<PlayerScoreDto> Scores);
