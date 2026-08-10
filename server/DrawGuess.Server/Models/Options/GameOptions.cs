namespace DrawGuess.Server.Models.Options;

public sealed class GameOptions
{
    public int MaxPlayersPerRoom { get; set; } = 12;
    public int DefaultTotalRounds { get; set; } = 3;
    public int DefaultRoundDurationSeconds { get; set; } = 60;
    public int RoundEndDelaySeconds { get; set; } = 5;
}
