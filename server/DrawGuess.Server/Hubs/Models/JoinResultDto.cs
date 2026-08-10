namespace DrawGuess.Server.Hubs.Models;

public sealed record JoinResultDto(
    bool Success,
    string? RoomId,
    string? PlayerId,
    GameStateSnapshotDto? State,
    string? Error);
