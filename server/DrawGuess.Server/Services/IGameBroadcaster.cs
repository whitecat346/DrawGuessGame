using DrawGuess.Server.Hubs.Models;

namespace DrawGuess.Server.Services;

public interface IGameBroadcaster
{
    Task GroupStateUpdatedAsync(string roomId, GameStateSnapshotDto state);
    Task ClientWordAssignedAsync(string connectionId, string word, IReadOnlyList<string> aliases);
    Task GroupChatAsync(string roomId, ChatMessageDto message);
    Task OthersDrawActionAsync(string roomId, string exceptConnectionId, DrawActionDto action);
    Task GroupCanvasClearedAsync(string roomId);
    Task GroupStrokeUndoneAsync(string roomId, string strokeId);
    Task ClientKickedAsync(string connectionId, string reason);
    Task ClientErrorAsync(string connectionId, string message);
}
