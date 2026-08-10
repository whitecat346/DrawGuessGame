namespace DrawGuess.Server.Hubs.Models;

public sealed record GameStateSnapshotDto(
    string RoomId,
    string State,
    RoomSettingsDto Settings,
    IReadOnlyList<PlayerInfoDto> Players,
    IReadOnlyList<PlayerScoreDto> Scores,
    int CurrentRound,
    int TotalRounds,
    string? CurrentDrawerId,
    int RemainingSeconds,
    int WordCount,
    KickVoteDto? KickVote,
    RoundSummaryDto? LastRound);
