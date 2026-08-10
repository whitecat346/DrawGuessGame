using DrawGuess.Server.Hubs.Models;
using DrawGuess.Server.Models;
using DrawGuess.Server.Models.Options;
using DrawGuess.Server.Services;
using Microsoft.Extensions.Options;

namespace DrawGuess.Server.Tests;

public class GameServiceFlowTests
{
    private static readonly DateTime StartUtc = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private readonly FakeTimeProvider _clock = new(StartUtc);
    private readonly FakeBroadcaster _bus = new();
    private readonly RoomManager _rooms = new();
    private readonly GameService _game;

    public GameServiceFlowTests()
    {
        _game = new GameService(
            _rooms,
            _bus,
            Options.Create(new GameOptions()),
            Options.Create(new KickOptions()),
            _clock);
    }

    [Fact]
    public async Task PreemptiveMode_FirstCorrectGuessEndsRoundAndScores()
    {
        var (roomId, ids) = await CreateRoomAsync();
        var hostId = ids["c1"];
        var guestId = ids["c2"];

        await _game.StartGameAsync("c1");
        Assert.Empty(_bus.Errors);

        Assert.True(_rooms.TryGetRoom(roomId, out var room));
        Assert.Equal(GameState.RoundActive, room!.State);
        Assert.Equal(1, room.CurrentRound);
        Assert.Equal(hostId, room.CurrentDrawerId);
        Assert.Contains(_bus.WordAssignments, w => w.ConnectionId == "c1" && w.Word == "苹果");

        await _game.HandleChatAsync("c2", "香蕉");
        Assert.Contains(_bus.Chats, m => m.PlayerName == "玩家2" && m.Kind == "chat" && m.Text == "香蕉");

        await _game.HandleChatAsync("c2", " apple ");
        Assert.Equal(GameState.RoundEnding, room.State);
        Assert.Equal("苹果", room.LastRound?.Answer);
        Assert.Contains(room.LastRound!.CorrectGuesserIds, id => id == guestId);
        Assert.Equal(100, room.Players.Single(p => p.Id == guestId).Score);
        Assert.Equal(20, room.Players.Single(p => p.Id == hostId).Score);
        Assert.Contains(_bus.Chats, m => m.Kind == "correct" && m.ScoreAwarded == 100 && m.PlayerId == guestId);
    }

    [Fact]
    public async Task DecreasingMode_ScoreDependsOnRemainingTime()
    {
        var (roomId, ids) = await CreateRoomAsync(playerCount: 3, mode: "Decreasing");
        await _game.StartGameAsync("c1");
        Assert.Empty(_bus.Errors);
        Assert.True(_rooms.TryGetRoom(roomId, out var room));

        _clock.NowUtc = StartUtc.AddSeconds(30);
        await _game.HandleChatAsync("c2", "苹果");
        Assert.Equal(50, room!.Players.Single(p => p.Id == ids["c2"]).Score);

        _clock.NowUtc = StartUtc.AddSeconds(45);
        await _game.HandleChatAsync("c3", "apple");
        Assert.Equal(25, room.Players.Single(p => p.Id == ids["c3"]).Score);
        Assert.Equal(40, room.Players.Single(p => p.Id == ids["c1"]).Score);
        Assert.Equal(GameState.RoundEnding, room.State);
    }

    [Fact]
    public async Task DrawerRotation_FollowsJoinOrder()
    {
        var (roomId, _) = await CreateRoomAsync(playerCount: 3, rounds: 3);
        await _game.StartGameAsync("c1");
        Assert.Empty(_bus.Errors);
        Assert.True(_rooms.TryGetRoom(roomId, out var room));

        Assert.Equal("c1", room!.CurrentDrawer?.ConnectionId);

        await _game.HandleChatAsync("c2", "苹果");
        Assert.Contains(_bus.Chats, m => m.Kind == "correct");
        Assert.Equal(GameState.RoundEnding, room.State);
        _clock.NowUtc = StartUtc.AddSeconds(6);
        await _game.TickAsync(room, _clock.NowUtc);
        Assert.Contains(_bus.Chats, m => m.Text.Contains("第 2 轮开始"));
        Assert.Equal(GameState.RoundActive, room.State);
        Assert.Equal(2, room.CurrentRound);
        Assert.Equal("c2", room.CurrentDrawer?.ConnectionId);

        await _game.HandleChatAsync("c3", "苹果");
        _clock.NowUtc = StartUtc.AddSeconds(12);
        await _game.TickAsync(room, _clock.NowUtc);
        Assert.Equal(3, room.CurrentRound);
        Assert.Equal("c3", room.CurrentDrawer?.ConnectionId);

        await _game.HandleChatAsync("c2", "苹果");
        _clock.NowUtc = StartUtc.AddSeconds(18);
        await _game.TickAsync(room, _clock.NowUtc);
        Assert.Equal(GameState.GameOver, room.State);
    }

    [Fact]
    public async Task VoteKick_RequiresMajorityAndBansFromRejoin()
    {
        var (roomId, ids) = await CreateRoomAsync(playerCount: 3);
        Assert.True(_rooms.TryGetRoom(roomId, out var room));

        await _game.VoteKickAsync("c2", ids["c3"]);
        Assert.NotNull(room!.ActiveKickVote);
        Assert.Single(room.ActiveKickVote!.YesVoterIds);

        await _game.VoteKickAsync("c1", ids["c3"]);
        Assert.Null(room.ActiveKickVote);
        Assert.DoesNotContain(room.Players, p => p.Id == ids["c3"]);
        Assert.Contains(_bus.Kicked, k => k.ConnectionId == "c3");

        var rejoin = await _game.JoinRoomAsync("c9", roomId, "小刚", "client-3");
        Assert.False(rejoin.Success);
        Assert.Contains("移出", rejoin.Error);
    }

    [Fact]
    public async Task HostCannotBeVoteKicked()
    {
        var (_, ids) = await CreateRoomAsync(playerCount: 3);

        await _game.VoteKickAsync("c2", ids["c1"]);
        Assert.Contains(_bus.Errors, e => e.Message.Contains("房主不可被踢"));
        Assert.Empty(_bus.Kicked);
    }

    [Fact]
    public async Task OnlyPainterCanDrawOrSendHint()
    {
        var (roomId, _) = await CreateRoomAsync();
        await _game.StartGameAsync("c1");

        await _game.SendDrawActionAsync("c2", new DrawActionDto("begin", "s1", 0.5f, 0.5f, "#000000", 4, 1.6f));
        Assert.DoesNotContain(_bus.DrawActions, d => d.RoomId == roomId);
        Assert.Contains(_bus.Errors, e => e.Message.Contains("只有当前画师可以作画"));

        await _game.SendDrawActionAsync("c1", new DrawActionDto("begin", "s1", 0.5f, 0.5f, "#000000", 4, 1.6f));
        Assert.Contains(_bus.DrawActions, d => d.RoomId == roomId && d.Action.StrokeId == "s1");

        await _game.HandleHintAsync("c2", "两个字");
        Assert.DoesNotContain(_bus.Chats, m => m.Kind == "hint");

        await _game.HandleHintAsync("c1", "两个字");
        Assert.Contains(_bus.Chats, m => m.Kind == "hint" && m.Text == "两个字");
    }

    [Fact]
    public async Task JoinRoom_RejectedWhenGameOver()
    {
        var (roomId, _) = await CreateRoomAsync(rounds: 1);
        await _game.StartGameAsync("c1");
        Assert.Empty(_bus.Errors);
        Assert.True(_rooms.TryGetRoom(roomId, out var room));

        await _game.HandleChatAsync("c2", "苹果");
        Assert.Contains(_bus.Chats, m => m.Kind == "correct");
        _clock.NowUtc = StartUtc.AddSeconds(6);
        await _game.TickAsync(room!, _clock.NowUtc);
        Assert.Equal(GameState.GameOver, room!.State);

        var join = await _game.JoinRoomAsync("c9", roomId, "新人", "client-9");
        Assert.False(join.Success);
        Assert.Contains("结束", join.Error);
    }

    [Fact]
    public async Task StartGame_RequiresTwoPlayersAndWordBank()
    {
        var create = await _game.CreateRoomAsync("c1", "小明", "client-1");
        await _game.SetWordBankAsync("c1", [new WordEntryDto("苹果", [])]);
        await _game.StartGameAsync("c1");
        Assert.Contains(_bus.Errors, e => e.Message.Contains("至少需要 2 名玩家"));

        _bus.Errors.Clear();
        await _game.JoinRoomAsync("c2", create.RoomId!, "小红", "client-2");
        _bus.Errors.Clear();
        await _game.SetWordBankAsync("c1", []);
        await _game.StartGameAsync("c1");
        Assert.Contains(_bus.Errors, e => e.Message.Contains("词库不能为空"));
    }

    [Fact]
    public async Task CreateRoomWithCode_AcceptsValidUniqueCode()
    {
        var result = await _game.CreateRoomWithCodeAsync("c1", "小明", "client-1", "ABC234");
        Assert.True(result.Success);
        Assert.Equal("ABC234", result.RoomId);
        Assert.True(_rooms.TryGetRoom("ABC234", out _));
    }

    [Theory]
    [InlineData("ABC23")]
    [InlineData("ABC0X1")]
    [InlineData("ABCIOL")]
    public async Task CreateRoomWithCode_RejectsInvalidFormat(string code)
    {
        var result = await _game.CreateRoomWithCodeAsync("c1", "小明", "client-1", code);
        Assert.False(result.Success);
        Assert.NotNull(result.Error);
    }

    [Fact]
    public async Task CreateRoomWithCode_RejectsDuplicateCode()
    {
        var first = await _game.CreateRoomWithCodeAsync("c1", "小明", "client-1", "ABC234");
        Assert.True(first.Success);

        var second = await _game.CreateRoomWithCodeAsync("c2", "小红", "client-2", "abc234");
        Assert.False(second.Success);
        Assert.Contains("占用", second.Error);
    }

    private async Task<(string RoomId, Dictionary<string, string> PlayerIds)> CreateRoomAsync(
        int playerCount = 2,
        string mode = "Preemptive",
        int rounds = 3,
        int duration = 60)
    {
        var create = await _game.CreateRoomAsync("c1", "小明", "client-1");
        Assert.True(create.Success);
        Assert.NotNull(create.RoomId);

        var playerIds = new Dictionary<string, string> { ["c1"] = create.PlayerId! };
        for (var i = 2; i <= playerCount; i++)
        {
            var join = await _game.JoinRoomAsync($"c{i}", create.RoomId, $"玩家{i}", $"client-{i}");
            Assert.True(join.Success);
            playerIds[$"c{i}"] = join.PlayerId!;
        }

        await _game.UpdateSettingsAsync("c1", new RoomSettingsDto(mode, rounds, duration));
        await _game.SetWordBankAsync("c1", [new WordEntryDto("苹果", ["apple"])]);
        return (create.RoomId, playerIds);
    }
}
