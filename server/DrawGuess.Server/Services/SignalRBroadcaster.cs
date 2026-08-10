using DrawGuess.Server.Hubs;
using DrawGuess.Server.Hubs.Models;
using Microsoft.AspNetCore.SignalR;

namespace DrawGuess.Server.Services;

public sealed class SignalRBroadcaster(IHubContext<GameHub, IGameClient> hubContext) : IGameBroadcaster
{
    public Task GroupStateUpdatedAsync(string roomId, GameStateSnapshotDto state)
        => hubContext.Clients.Group(roomId).GameStateUpdatedAsync(state);

    public Task ClientWordAssignedAsync(string connectionId, string word, IReadOnlyList<string> aliases)
        => hubContext.Clients.Client(connectionId).WordAssignedAsync(word, aliases);

    public Task GroupChatAsync(string roomId, ChatMessageDto message)
        => hubContext.Clients.Group(roomId).ChatReceivedAsync(message);

    public Task OthersDrawActionAsync(string roomId, string exceptConnectionId, DrawActionDto action)
        => hubContext.Clients.GroupExcept(roomId, exceptConnectionId).DrawActionReceivedAsync(action);

    public Task GroupCanvasClearedAsync(string roomId)
        => hubContext.Clients.Group(roomId).CanvasClearedAsync();

    public Task GroupStrokeUndoneAsync(string roomId, string strokeId)
        => hubContext.Clients.Group(roomId).StrokeUndoneAsync(strokeId);

    public Task ClientKickedAsync(string connectionId, string reason)
        => hubContext.Clients.Client(connectionId).KickedAsync(reason);

    public Task ClientErrorAsync(string connectionId, string message)
        => hubContext.Clients.Client(connectionId).ErrorAsync(message);
}
