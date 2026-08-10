using DrawGuess.Server.Hubs.Models;
using DrawGuess.Server.Services;

namespace DrawGuess.Server.Tests;

public sealed class FakeBroadcaster : IGameBroadcaster
{
    public List<GameStateSnapshotDto> States { get; } = [];
    public List<ChatMessageDto> Chats { get; } = [];
    public List<(string ConnectionId, string Word, IReadOnlyList<string> Aliases)> WordAssignments { get; } = [];
    public List<(string RoomId, DrawActionDto Action)> DrawActions { get; } = [];
    public List<string> CanvasClearedRooms { get; } = [];
    public List<(string RoomId, string StrokeId)> UndoneStrokes { get; } = [];
    public List<(string ConnectionId, string Reason)> Kicked { get; } = [];
    public List<(string ConnectionId, string Message)> Errors { get; } = [];

    public Task GroupStateUpdatedAsync(string roomId, GameStateSnapshotDto state)
    {
        States.Add(state);
        return Task.CompletedTask;
    }

    public Task ClientWordAssignedAsync(string connectionId, string word, IReadOnlyList<string> aliases)
    {
        WordAssignments.Add((connectionId, word, aliases));
        return Task.CompletedTask;
    }

    public Task GroupChatAsync(string roomId, ChatMessageDto message)
    {
        Chats.Add(message);
        return Task.CompletedTask;
    }

    public Task OthersDrawActionAsync(string roomId, string exceptConnectionId, DrawActionDto action)
    {
        DrawActions.Add((roomId, action));
        return Task.CompletedTask;
    }

    public Task GroupCanvasClearedAsync(string roomId)
    {
        CanvasClearedRooms.Add(roomId);
        return Task.CompletedTask;
    }

    public Task GroupStrokeUndoneAsync(string roomId, string strokeId)
    {
        UndoneStrokes.Add((roomId, strokeId));
        return Task.CompletedTask;
    }

    public Task ClientKickedAsync(string connectionId, string reason)
    {
        Kicked.Add((connectionId, reason));
        return Task.CompletedTask;
    }

    public Task ClientErrorAsync(string connectionId, string message)
    {
        Errors.Add((connectionId, message));
        return Task.CompletedTask;
    }
}
