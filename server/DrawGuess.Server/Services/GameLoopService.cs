using DrawGuess.Server.Models;

namespace DrawGuess.Server.Services;

public sealed class GameLoopService(
    RoomManager rooms,
    GameService game,
    ILogger<GameLoopService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false))
        {
            var now = DateTime.UtcNow;
            foreach (var room in rooms.AllRooms.ToArray())
            {
                try
                {
                    await game.TickAsync(room, now).ConfigureAwait(false);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Room {RoomId} tick failed", room.RoomId);
                }
            }
        }
    }
}
