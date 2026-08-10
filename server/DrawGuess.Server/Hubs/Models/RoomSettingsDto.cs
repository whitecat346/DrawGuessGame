namespace DrawGuess.Server.Hubs.Models;

public sealed record RoomSettingsDto(string ScoreMode, int TotalRounds, int RoundDurationSeconds);
