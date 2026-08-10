namespace DrawGuess.Server.Hubs.Models;

public sealed record KickVoteDto(
    string TargetId,
    string TargetName,
    string InitiatorId,
    int YesVotes,
    int RequiredVotes,
    int RemainingSeconds);
