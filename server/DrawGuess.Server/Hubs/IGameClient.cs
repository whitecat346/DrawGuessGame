using DrawGuess.Server.Hubs.Models;

namespace DrawGuess.Server.Hubs;

public interface IGameClient
{
    Task GameStateUpdatedAsync(GameStateSnapshotDto state);
    Task WordAssignedAsync(string word, IReadOnlyList<string> aliases);
    Task ChatReceivedAsync(ChatMessageDto message);
    Task DrawActionReceivedAsync(DrawActionDto action);
    Task CanvasClearedAsync();
    Task StrokeUndoneAsync(string strokeId);
    Task KickedAsync(string reason);
    Task ErrorAsync(string message);
}
