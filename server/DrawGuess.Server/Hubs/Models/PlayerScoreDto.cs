namespace DrawGuess.Server.Hubs.Models;

public sealed record PlayerScoreDto(string PlayerId, string Name, int Score);
