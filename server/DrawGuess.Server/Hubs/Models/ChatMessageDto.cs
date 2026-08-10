namespace DrawGuess.Server.Hubs.Models;

public sealed record ChatMessageDto(
    string Id,
    string? PlayerId,
    string PlayerName,
    string Text,
    string Kind,
    int? ScoreAwarded);
