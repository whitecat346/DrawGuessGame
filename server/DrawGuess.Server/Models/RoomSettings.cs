using DrawGuess.Server.Models;

namespace DrawGuess.Server.Models;

public sealed class RoomSettings
{
    public const int MinTotalRounds = 1;
    public const int MaxTotalRounds = 20;
    public const int MinRoundDurationSeconds = 15;
    public const int MaxRoundDurationSeconds = 300;

    public int TotalRounds { get; set; } = 3;
    public int RoundDurationSeconds { get; set; } = 60;
    public ScoreMode ScoreMode { get; set; } = ScoreMode.Preemptive;
}
