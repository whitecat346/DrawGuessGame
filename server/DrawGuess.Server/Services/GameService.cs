using DrawGuess.Server.Hubs.Models;
using DrawGuess.Server.Models;
using DrawGuess.Server.Models.Options;
using Microsoft.Extensions.Options;

namespace DrawGuess.Server.Services;

public sealed class GameService(
    RoomManager rooms,
    IGameBroadcaster bus,
    IOptions<GameOptions> gameOptions,
    IOptions<KickOptions> kickOptions,
    TimeProvider clock)
{
    private readonly GameOptions _game = gameOptions.Value;
    private readonly KickOptions _kick = kickOptions.Value;
    private readonly TimeProvider _clock = clock;

    public async Task<JoinResultDto> CreateRoomAsync(string connectionId, string playerName, string clientId)
    {
        var nameError = GameEngine.ValidatePlayerName(playerName);
        if (nameError is not null)
        {
            return FailedJoin(nameError);
        }

        var clientError = GameEngine.ValidateClientId(clientId);
        if (clientError is not null)
        {
            return FailedJoin(clientError);
        }

        var name = playerName.Trim();
        var room = rooms.CreateRoom(connectionId, name, clientId);
        var state = CreateSnapshot(room, _clock.GetUtcNow().UtcDateTime);
        return new JoinResultDto(true, room.RoomId, room.Players[0].Id, state, null);
    }

    public async Task<JoinResultDto> JoinRoomAsync(string connectionId, string roomId, string playerName, string clientId)
    {
        var nameError = GameEngine.ValidatePlayerName(playerName);
        if (nameError is not null)
        {
            return FailedJoin(nameError);
        }

        var clientError = GameEngine.ValidateClientId(clientId);
        if (clientError is not null)
        {
            return FailedJoin(clientError);
        }

        var normalizedRoomId = roomId?.Trim().ToUpperInvariant();
        if (string.IsNullOrEmpty(normalizedRoomId) || !rooms.TryGetRoom(normalizedRoomId, out var room))
        {
            return FailedJoin("房间不存在");
        }

        await room.Sync.WaitAsync();
        try
        {
            if (room.BannedClientIds.Contains(clientId))
            {
                return FailedJoin("你已被移出本局，无法重进");
            }

            if (room.State == GameState.GameOver)
            {
                return FailedJoin("游戏已结束，请等待房主重开");
            }

            if (room.Players.Count >= _game.MaxPlayersPerRoom)
            {
                return FailedJoin("房间已满");
            }

            var player = new Player
            {
                Id = Guid.NewGuid().ToString("N"),
                ConnectionId = connectionId,
                Name = playerName.Trim(),
                ClientId = clientId
            };
            room.Players.Add(player);
            room.DrawerOrder.Add(player.Id);

            var now = _clock.GetUtcNow().UtcDateTime;
            var state = CreateSnapshot(room, now);
            await bus.GroupChatAsync(room.RoomId, SystemMessage($"{player.Name} 加入了房间"));
            await bus.GroupStateUpdatedAsync(room.RoomId, state);
            return new JoinResultDto(true, room.RoomId, player.Id, state, null);
        }
        finally
        {
            room.Sync.Release();
        }
    }

    public async Task HandleLeaveAsync(string connectionId)
    {
        var (room, player) = rooms.FindByConnectionId(connectionId);
        if (room is null || player is null)
        {
            return;
        }

        await room.Sync.WaitAsync();
        try
        {
            var now = _clock.GetUtcNow().UtcDateTime;
            var name = player.Name;
            var wasHost = player.IsHost;

            room.Players.Remove(player);
            if (room.Players.Count == 0)
            {
                rooms.RemoveRoom(room.RoomId);
                return;
            }

            ClearVoteForLeaver(room, player);
            if (wasHost)
            {
                TransferHost(room);
            }

            var drawerLeft = room.CurrentDrawerId == player.Id;
            if (room.State is GameState.RoundActive or GameState.RoundEnding && room.Players.Count < 2)
            {
                await ReturnToWaitingAsync(room, $"{name} 离开了房间，人数不足，游戏已暂停", now);
                return;
            }

            await bus.GroupChatAsync(room.RoomId, SystemMessage($"{name} 离开了房间"));
            if (drawerLeft && room.State == GameState.RoundActive)
            {
                await EndRoundAsync(room, now);
            }
            else
            {
                await bus.GroupStateUpdatedAsync(room.RoomId, CreateSnapshot(room, now));
            }
        }
        finally
        {
            room.Sync.Release();
        }
    }

    public async Task UpdateSettingsAsync(string connectionId, RoomSettingsDto settings)
    {
        var (room, player) = rooms.FindByConnectionId(connectionId);
        if (room is null || player is null)
        {
            await bus.ClientErrorAsync(connectionId, "你不在任何房间中");
            return;
        }

        await room.Sync.WaitAsync();
        try
        {
            if (!player.IsHost)
            {
                await bus.ClientErrorAsync(connectionId, "只有房主可以修改设置");
                return;
            }

            if (room.State != GameState.Waiting)
            {
                await bus.ClientErrorAsync(connectionId, "对局进行中，无法修改设置");
                return;
            }

            var (valid, error) = GameEngine.ValidateSettings(settings);
            if (!valid)
            {
                await bus.ClientErrorAsync(connectionId, error!);
                return;
            }

            room.Settings = GameEngine.ToSettings(settings);
            await bus.GroupStateUpdatedAsync(room.RoomId, CreateSnapshot(room, _clock.GetUtcNow().UtcDateTime));
        }
        finally
        {
            room.Sync.Release();
        }
    }

    public async Task SetWordBankAsync(string connectionId, IReadOnlyList<WordEntryDto> words)
    {
        var (room, player) = rooms.FindByConnectionId(connectionId);
        if (room is null || player is null)
        {
            await bus.ClientErrorAsync(connectionId, "你不在任何房间中");
            return;
        }

        await room.Sync.WaitAsync();
        try
        {
            if (!player.IsHost)
            {
                await bus.ClientErrorAsync(connectionId, "只有房主可以导入词库");
                return;
            }

            if (room.State != GameState.Waiting)
            {
                await bus.ClientErrorAsync(connectionId, "对局进行中，无法修改词库");
                return;
            }

            var (valid, error) = GameEngine.ValidateWordBank(words);
            if (!valid)
            {
                await bus.ClientErrorAsync(connectionId, error!);
                return;
            }

            room.WordBank.Clear();
            room.WordBank.AddRange(words.Select(w => new WordEntry
            {
                Word = w.Word.Trim(),
                Aliases = w.Aliases.Where(a => !string.IsNullOrWhiteSpace(a)).Select(a => a.Trim()).ToList()
            }));
            room.UsedWordIndexes.Clear();
            await bus.GroupStateUpdatedAsync(room.RoomId, CreateSnapshot(room, _clock.GetUtcNow().UtcDateTime));
        }
        finally
        {
            room.Sync.Release();
        }
    }

    public async Task StartGameAsync(string connectionId, bool allowGameOver = false)
    {
        var (room, player) = rooms.FindByConnectionId(connectionId);
        if (room is null || player is null)
        {
            await bus.ClientErrorAsync(connectionId, "你不在任何房间中");
            return;
        }

        await room.Sync.WaitAsync();
        try
        {
            if (!player.IsHost)
            {
                await bus.ClientErrorAsync(connectionId, "只有房主可以开始游戏");
                return;
            }

            if (room.State != GameState.Waiting && !(allowGameOver && room.State == GameState.GameOver))
            {
                await bus.ClientErrorAsync(connectionId, "当前状态无法开始游戏");
                return;
            }

            if (room.Players.Count < 2)
            {
                await bus.ClientErrorAsync(connectionId, "至少需要 2 名玩家才能开始");
                return;
            }

            if (room.WordBank.Count == 0)
            {
                await bus.ClientErrorAsync(connectionId, "请先导入词库");
                return;
            }

            ResetForNewGame(room);
            room.CurrentRound = 1;
            var now = _clock.GetUtcNow().UtcDateTime;
            await StartRoundAsync(room, now);
            await bus.GroupChatAsync(room.RoomId, SystemMessage("游戏开始！"));
        }
        finally
        {
            room.Sync.Release();
        }
    }

    public async Task HandleChatAsync(string connectionId, string text)
    {
        var (room, player) = rooms.FindByConnectionId(connectionId);
        if (room is null || player is null)
        {
            await bus.ClientErrorAsync(connectionId, "你不在任何房间中");
            return;
        }

        var textError = GameEngine.ValidateChatText(text);
        if (textError is not null)
        {
            await bus.ClientErrorAsync(connectionId, textError);
            return;
        }

        var trimmed = text.Trim();
        if (trimmed.Length == 0)
        {
            return;
        }

        await room.Sync.WaitAsync();
        try
        {
            var now = _clock.GetUtcNow().UtcDateTime;
            var isGuessing = room.State == GameState.RoundActive &&
                             player.Id != room.CurrentDrawerId &&
                             room.CurrentWord is not null;

            if (isGuessing &&
                GameEngine.MatchesWord(room.CurrentWord!, trimmed) &&
                !room.CorrectGuesserIds.Contains(player.Id))
            {
                var score = AwardCorrectGuess(room, player, now);
                await bus.GroupChatAsync(room.RoomId, new ChatMessageDto(NewId(), player.Id, player.Name, trimmed, "correct", score));

                if (room.Settings.ScoreMode == ScoreMode.Preemptive ||
                    room.CorrectGuesserIds.Count >= room.Players.Count - 1)
                {
                    await EndRoundAsync(room, now);
                }
                else
                {
                    await bus.GroupStateUpdatedAsync(room.RoomId, CreateSnapshot(room, now));
                }

                return;
            }

            await bus.GroupChatAsync(room.RoomId, new ChatMessageDto(NewId(), player.Id, player.Name, trimmed, "chat", null));
        }
        finally
        {
            room.Sync.Release();
        }
    }

    public async Task HandleHintAsync(string connectionId, string text)
    {
        var (room, player) = rooms.FindByConnectionId(connectionId);
        if (room is null || player is null)
        {
            return;
        }

        var hintError = GameEngine.ValidateHintText(text);
        if (hintError is not null)
        {
            await bus.ClientErrorAsync(connectionId, hintError);
            return;
        }

        await room.Sync.WaitAsync();
        try
        {
            if (room.State != GameState.RoundActive || player.Id != room.CurrentDrawerId)
            {
                await bus.ClientErrorAsync(connectionId, "只有当前画师可以发送提示");
                return;
            }

            await bus.GroupChatAsync(room.RoomId, new ChatMessageDto(NewId(), player.Id, player.Name, text.Trim(), "hint", null));
        }
        finally
        {
            room.Sync.Release();
        }
    }

    public async Task SendDrawActionAsync(string connectionId, DrawActionDto action)
    {
        var (valid, error) = GameEngine.ValidateDrawAction(action);
        if (!valid)
        {
            await bus.ClientErrorAsync(connectionId, error!);
            return;
        }

        var (room, player) = rooms.FindByConnectionId(connectionId);
        if (room is null || player is null)
        {
            return;
        }

        await room.Sync.WaitAsync();
        try
        {
            if (room.State != GameState.RoundActive || player.Id != room.CurrentDrawerId)
            {
                await bus.ClientErrorAsync(connectionId, "只有当前画师可以作画");
                return;
            }

            await bus.OthersDrawActionAsync(room.RoomId, connectionId, action);
        }
        finally
        {
            room.Sync.Release();
        }
    }

    public async Task ClearCanvasAsync(string connectionId)
    {
        var (room, player) = rooms.FindByConnectionId(connectionId);
        if (room is null || player is null)
        {
            return;
        }

        await room.Sync.WaitAsync();
        try
        {
            if (room.State != GameState.RoundActive || player.Id != room.CurrentDrawerId)
            {
                return;
            }

            await bus.GroupCanvasClearedAsync(room.RoomId);
        }
        finally
        {
            room.Sync.Release();
        }
    }

    public async Task UndoStrokeAsync(string connectionId, string strokeId)
    {
        if (string.IsNullOrEmpty(strokeId) || strokeId.Length > GameEngine.MaxStrokeIdLength)
        {
            return;
        }

        var (room, player) = rooms.FindByConnectionId(connectionId);
        if (room is null || player is null)
        {
            return;
        }

        await room.Sync.WaitAsync();
        try
        {
            if (room.State != GameState.RoundActive || player.Id != room.CurrentDrawerId)
            {
                return;
            }

            await bus.GroupStrokeUndoneAsync(room.RoomId, strokeId);
        }
        finally
        {
            room.Sync.Release();
        }
    }

    public async Task VoteKickAsync(string connectionId, string targetId)
    {
        var (room, player) = rooms.FindByConnectionId(connectionId);
        if (room is null || player is null)
        {
            return;
        }

        await room.Sync.WaitAsync();
        try
        {
            var now = _clock.GetUtcNow().UtcDateTime;
            if (room.State == GameState.GameOver)
            {
                return;
            }

            if (targetId == player.Id)
            {
                await bus.ClientErrorAsync(connectionId, "不能对自己发起投票");
                return;
            }

            var target = room.Players.FirstOrDefault(p => p.Id == targetId);
            if (target is null)
            {
                return;
            }

            if (target.IsHost)
            {
                await bus.ClientErrorAsync(connectionId, "房主不可被踢");
                return;
            }

            var vote = room.ActiveKickVote;
            if (vote is null)
            {
                room.ActiveKickVote = new KickVote
                {
                    TargetId = targetId,
                    InitiatorId = player.Id,
                    ExpiresAtUtc = now.AddSeconds(_kick.VoteDurationSeconds)
                };
                room.ActiveKickVote.YesVoterIds.Add(player.Id);
                await bus.GroupChatAsync(room.RoomId, SystemMessage($"{player.Name} 发起了对 {target.Name} 的踢人投票"));
                await bus.GroupStateUpdatedAsync(room.RoomId, CreateSnapshot(room, now));
                return;
            }

            if (vote.TargetId != targetId || !vote.YesVoterIds.Add(player.Id))
            {
                return;
            }

            var required = GameEngine.RequiredKickVotes(room.Players.Count);
            if (vote.YesVoterIds.Count < required)
            {
                await bus.GroupStateUpdatedAsync(room.RoomId, CreateSnapshot(room, now));
                return;
            }

            room.ActiveKickVote = null;
            room.Players.Remove(target);
            room.BannedClientIds.Add(target.ClientId);
            await bus.ClientKickedAsync(target.ConnectionId, "你已被投票移出房间");
            await bus.GroupChatAsync(room.RoomId, SystemMessage($"{target.Name} 已被投票移出房间"));

            if (room.Players.Count < 2 && room.State is GameState.RoundActive or GameState.RoundEnding)
            {
                await ReturnToWaitingAsync(room, "人数不足，游戏回到等待界面", now);
            }
            else if (room.State == GameState.RoundActive && room.CurrentDrawerId == target.Id)
            {
                await EndRoundAsync(room, now);
            }
            else
            {
                await bus.GroupStateUpdatedAsync(room.RoomId, CreateSnapshot(room, now));
            }
        }
        finally
        {
            room.Sync.Release();
        }
    }

    public async Task TickAsync(Room room, DateTime now)
    {
        await room.Sync.WaitAsync();
        try
        {
            switch (room.State)
            {
                case GameState.RoundActive when now >= room.RoundEndsAtUtc:
                    await EndRoundAsync(room, now);
                    break;
                case GameState.RoundEnding when now >= room.NextTransitionAtUtc:
                    await NextRoundAsync(room, now);
                    break;
                default:
                    if (room.ActiveKickVote is { } vote && now >= vote.ExpiresAtUtc)
                    {
                        room.ActiveKickVote = null;
                        await bus.GroupStateUpdatedAsync(room.RoomId, CreateSnapshot(room, now));
                    }
                    else if (room.State is GameState.RoundActive or GameState.RoundEnding)
                    {
                        await bus.GroupStateUpdatedAsync(room.RoomId, CreateSnapshot(room, now));
                    }

                    break;
            }
        }
        finally
        {
            room.Sync.Release();
        }
    }

    public static GameStateSnapshotDto CreateSnapshot(Room room, DateTime now)
    {
        var remainingSeconds = room.State is GameState.RoundActive or GameState.RoundEnding
            ? Math.Max(0, (int)Math.Ceiling((room.RoundEndsAtUtc - now).TotalSeconds))
            : 0;

        KickVoteDto? kickVote = null;
        if (room.ActiveKickVote is { } vote)
        {
            kickVote = new KickVoteDto(
                vote.TargetId,
                room.Players.FirstOrDefault(p => p.Id == vote.TargetId)?.Name ?? "",
                vote.InitiatorId,
                vote.YesVoterIds.Count,
                GameEngine.RequiredKickVotes(room.Players.Count),
                Math.Max(0, (int)Math.Ceiling((vote.ExpiresAtUtc - now).TotalSeconds)));
        }

        return new GameStateSnapshotDto(
            room.RoomId,
            room.State.ToString(),
            new RoomSettingsDto(
                room.Settings.ScoreMode.ToString(),
                room.Settings.TotalRounds,
                room.Settings.RoundDurationSeconds),
            room.Players.Select(p => new PlayerInfoDto(p.Id, p.Name, p.IsHost)).ToList(),
            room.Players.Select(p => new PlayerScoreDto(p.Id, p.Name, p.Score)).ToList(),
            room.CurrentRound,
            room.Settings.TotalRounds,
            room.CurrentDrawerId,
            remainingSeconds,
            room.WordBank.Count,
            kickVote,
            room.LastRound);
    }

    private static void ResetForNewGame(Room room)
    {
        foreach (var player in room.Players)
        {
            player.Score = 0;
        }

        room.CurrentRound = 0;
        room.CurrentDrawerId = null;
        room.CurrentWord = null;
        room.UsedWordIndexes.Clear();
        room.CorrectGuessersInOrder.Clear();
        room.CorrectGuesserIds.Clear();
        room.ActiveKickVote = null;
        room.LastRound = null;
    }

    private static WordEntry PickNextWord(Room room)
    {
        if (room.UsedWordIndexes.Count >= room.WordBank.Count)
        {
            room.UsedWordIndexes.Clear();
        }

        var available = Enumerable.Range(0, room.WordBank.Count)
            .Where(i => !room.UsedWordIndexes.Contains(i))
            .ToList();
        var index = available[Random.Shared.Next(available.Count)];
        room.UsedWordIndexes.Add(index);
        return room.WordBank[index];
    }

    private async Task StartRoundAsync(Room room, DateTime now)
    {
        room.State = GameState.RoundActive;
        room.CurrentWord = PickNextWord(room);
        room.RoundStartedAtUtc = now;
        room.RoundEndsAtUtc = now.AddSeconds(room.Settings.RoundDurationSeconds);
        room.CorrectGuessersInOrder.Clear();
        room.CorrectGuesserIds.Clear();
        room.LastRound = null;

        var drawerIndex = GameEngine.NextDrawerIndex(
            room.DrawerOrder,
            room.CurrentDrawerId,
            id => room.Players.Any(p => p.Id == id));
        room.CurrentDrawerId = drawerIndex is { } index ? room.DrawerOrder[index] : room.Players[0].Id;

        await bus.GroupCanvasClearedAsync(room.RoomId);
        await bus.GroupStateUpdatedAsync(room.RoomId, CreateSnapshot(room, now));

        var drawer = room.CurrentDrawer;
        if (drawer is not null && room.CurrentWord is not null)
        {
            await bus.ClientWordAssignedAsync(drawer.ConnectionId, room.CurrentWord.Word, room.CurrentWord.Aliases);
        }
    }

    private async Task EndRoundAsync(Room room, DateTime now)
    {
        room.State = GameState.RoundEnding;
        room.NextTransitionAtUtc = now.AddSeconds(_game.RoundEndDelaySeconds);
        room.LastRound = new RoundSummaryDto(
            room.CurrentRound,
            room.CurrentWord?.Word,
            room.CorrectGuessersInOrder.Select(p => p.Id).ToList(),
            room.Players.Select(p => new PlayerScoreDto(p.Id, p.Name, p.Score)).ToList());

        await bus.GroupChatAsync(room.RoomId, SystemMessage($"第 {room.CurrentRound} 轮结束，答案是「{room.CurrentWord?.Word}」"));
        await bus.GroupStateUpdatedAsync(room.RoomId, CreateSnapshot(room, now));
    }

    private async Task NextRoundAsync(Room room, DateTime now)
    {
        if (room.CurrentRound >= room.Settings.TotalRounds)
        {
            room.State = GameState.GameOver;
            await bus.GroupChatAsync(room.RoomId, SystemMessage("游戏结束！查看最终排名"));
            await bus.GroupStateUpdatedAsync(room.RoomId, CreateSnapshot(room, now));
            return;
        }

        room.CurrentRound++;
        await StartRoundAsync(room, now);
        await bus.GroupChatAsync(room.RoomId, SystemMessage($"第 {room.CurrentRound} 轮开始"));
    }

    private async Task ReturnToWaitingAsync(Room room, string reason, DateTime now)
    {
        room.State = GameState.Waiting;
        room.CurrentRound = 0;
        room.CurrentDrawerId = null;
        room.CurrentWord = null;
        room.CorrectGuessersInOrder.Clear();
        room.CorrectGuesserIds.Clear();
        room.ActiveKickVote = null;
        room.LastRound = null;

        await bus.GroupCanvasClearedAsync(room.RoomId);
        await bus.GroupChatAsync(room.RoomId, SystemMessage(reason));
        await bus.GroupStateUpdatedAsync(room.RoomId, CreateSnapshot(room, now));
    }

    private static int AwardCorrectGuess(Room room, Player guesser, DateTime now)
    {
        var score = room.Settings.ScoreMode == ScoreMode.Preemptive
            ? 100
            : GameEngine.DecreasingScore(room.RoundEndsAtUtc - room.RoundStartedAtUtc, room.RoundEndsAtUtc - now);

        guesser.Score += score;
        room.CurrentDrawer!.Score += 20;
        room.CorrectGuessersInOrder.Add(guesser);
        room.CorrectGuesserIds.Add(guesser.Id);
        return score;
    }

    private static void ClearVoteForLeaver(Room room, Player leaver)
    {
        if (room.ActiveKickVote is not { } vote)
        {
            return;
        }

        if (vote.TargetId == leaver.Id || vote.InitiatorId == leaver.Id)
        {
            room.ActiveKickVote = null;
        }
    }

    private static void TransferHost(Room room)
    {
        foreach (var player in room.Players)
        {
            player.IsHost = false;
        }

        var nextHost = room.DrawerOrder
            .Select(id => room.Players.FirstOrDefault(p => p.Id == id))
            .FirstOrDefault(p => p is not null);
        if (nextHost is not null)
        {
            nextHost.IsHost = true;
        }
    }

    private static ChatMessageDto SystemMessage(string text)
        => new(NewId(), null, "系统", text, "system", null);

    private static string NewId() => Guid.NewGuid().ToString("N");

    private static JoinResultDto FailedJoin(string error)
        => new(false, null, null, null, error);
}
