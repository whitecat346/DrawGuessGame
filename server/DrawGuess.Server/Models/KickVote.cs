namespace DrawGuess.Server.Models;

public sealed class KickVote
{
    public required string TargetId { get; init; }
    public required string InitiatorId { get; init; }
    public HashSet<string> YesVoterIds { get; } = [];
    public required DateTime ExpiresAtUtc { get; init; }
}
