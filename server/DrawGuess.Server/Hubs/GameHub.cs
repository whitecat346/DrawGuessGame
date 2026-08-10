using DrawGuess.Server.Hubs.Models;
using DrawGuess.Server.Services;
using Microsoft.AspNetCore.SignalR;

namespace DrawGuess.Server.Hubs;

public sealed class GameHub(
    RoomManager rooms,
    GameService game,
    ILogger<GameHub> logger) : Hub<IGameClient>
{
    public async Task<JoinResultDto> CreateRoomAsync(string playerName, string clientId)
    {
        var result = await game.CreateRoomAsync(Context.ConnectionId, playerName, clientId).ConfigureAwait(false);
        if (result.Success && result.RoomId is not null)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, result.RoomId).ConfigureAwait(false);
        }

        return result;
    }

    public async Task<JoinResultDto> JoinRoomAsync(string roomId, string playerName, string clientId)
    {
        var result = await game.JoinRoomAsync(Context.ConnectionId, roomId, playerName, clientId).ConfigureAwait(false);
        if (result.Success && result.RoomId is not null)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, result.RoomId).ConfigureAwait(false);
        }

        return result;
    }

    public Task<GameStateSnapshotDto?> GetStateAsync()
    {
        var (room, _) = rooms.FindByConnectionId(Context.ConnectionId);
        return Task.FromResult(room is null ? null : GameService.CreateSnapshot(room, DateTime.UtcNow));
    }

    public async Task LeaveRoomAsync()
    {
        await game.HandleLeaveAsync(Context.ConnectionId).ConfigureAwait(false);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GetRoomIdOrEmpty()).ConfigureAwait(false);
    }

    public async Task UpdateSettingsAsync(RoomSettingsDto settings)
    {
        await game.UpdateSettingsAsync(Context.ConnectionId, settings).ConfigureAwait(false);
    }

    public async Task SetWordBankAsync(IReadOnlyList<WordEntryDto> words)
    {
        await game.SetWordBankAsync(Context.ConnectionId, words).ConfigureAwait(false);
    }

    public async Task StartGameAsync()
    {
        await game.StartGameAsync(Context.ConnectionId).ConfigureAwait(false);
    }

    public async Task RestartGameAsync()
    {
        await game.StartGameAsync(Context.ConnectionId, allowGameOver: true).ConfigureAwait(false);
    }

    public async Task SendChatAsync(string text)
    {
        await game.HandleChatAsync(Context.ConnectionId, text).ConfigureAwait(false);
    }

    public async Task SendHintAsync(string text)
    {
        await game.HandleHintAsync(Context.ConnectionId, text).ConfigureAwait(false);
    }

    public async Task SendDrawActionAsync(DrawActionDto action)
    {
        logger.LogDebug(
            "DrawAction from {ConnectionId}: type={Type} stroke={StrokeId} point=({X},{Y}) color={Color} size={Size}",
            Context.ConnectionId, action.Type, action.StrokeId, action.X, action.Y, action.Color, action.Size);
        await game.SendDrawActionAsync(Context.ConnectionId, action).ConfigureAwait(false);
    }

    public async Task ClearCanvasAsync()
    {
        await game.ClearCanvasAsync(Context.ConnectionId).ConfigureAwait(false);
    }

    public async Task UndoStrokeAsync(string strokeId)
    {
        await game.UndoStrokeAsync(Context.ConnectionId, strokeId).ConfigureAwait(false);
    }

    public async Task VoteKickAsync(string targetPlayerId)
    {
        await game.VoteKickAsync(Context.ConnectionId, targetPlayerId).ConfigureAwait(false);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await game.HandleLeaveAsync(Context.ConnectionId).ConfigureAwait(false);
        await base.OnDisconnectedAsync(exception).ConfigureAwait(false);
    }

    private string GetRoomIdOrEmpty()
    {
        var (room, _) = rooms.FindByConnectionId(Context.ConnectionId);
        return room?.RoomId ?? string.Empty;
    }
}
