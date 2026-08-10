namespace DrawGuess.Server.Models;

public sealed class Player
{
    public required string Id { get; init; }
    public required string ConnectionId { get; set; }
    public required string Name { get; set; }
    public required string ClientId { get; init; }
    public bool IsHost { get; set; }
    public int Score { get; set; }
}
