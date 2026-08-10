using DrawGuess.Server.Hubs.Models;

namespace DrawGuess.Server.Models;

public sealed class Room
{
    public required string RoomId { get; init; }
    public RoomSettings Settings { get; set; } = new();
    public GameState State { get; set; } = GameState.Waiting;
    public List<Player> Players { get; } = [];
    public List<string> DrawerOrder { get; } = [];
    public List<WordEntry> WordBank { get; } = [];
    public HashSet<int> UsedWordIndexes { get; } = [];
    public int CurrentRound { get; set; }
    public string? CurrentDrawerId { get; set; }
    public WordEntry? CurrentWord { get; set; }
    public DateTime RoundStartedAtUtc { get; set; }
    public DateTime RoundEndsAtUtc { get; set; }
    public DateTime NextTransitionAtUtc { get; set; }
    public List<Player> CorrectGuessersInOrder { get; } = [];
    public HashSet<string> CorrectGuesserIds { get; } = [];
    public KickVote? ActiveKickVote { get; set; }
    public HashSet<string> BannedClientIds { get; } = [];
    public RoundSummaryDto? LastRound { get; set; }
    public SemaphoreSlim Sync { get; } = new(1, 1);

    public Player? CurrentDrawer => Players.FirstOrDefault(p => p.Id == CurrentDrawerId);
}
