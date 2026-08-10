using System.Collections.Concurrent;
using DrawGuess.Server.Models;

namespace DrawGuess.Server.Services;

public sealed class RoomManager
{
    private readonly ConcurrentDictionary<string, Room> _rooms = new(StringComparer.OrdinalIgnoreCase);

    public Room CreateRoom(string connectionId, string playerName, string clientId)
    {
        var room = new Room { RoomId = GenerateRoomId() };
        var host = new Player
        {
            Id = Guid.NewGuid().ToString("N"),
            ConnectionId = connectionId,
            Name = playerName,
            ClientId = clientId,
            IsHost = true
        };
        room.Players.Add(host);
        room.DrawerOrder.Add(host.Id);
        _rooms[room.RoomId] = room;
        return room;
    }

    public bool TryGetRoom(string roomId, out Room room)
    {
        return _rooms.TryGetValue(roomId, out room!);
    }

    public (Room? Room, Player? Player) FindByConnectionId(string connectionId)
    {
        foreach (var room in _rooms.Values)
        {
            var player = room.Players.FirstOrDefault(p => p.ConnectionId == connectionId);
            if (player is not null)
            {
                return (room, player);
            }
        }

        return (null, null);
    }

    public bool RemoveRoom(string roomId)
    {
        return _rooms.TryRemove(roomId, out _);
    }

    public IReadOnlyCollection<Room> AllRooms => _rooms.Values.ToArray();

    private static string GenerateRoomId()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        return string.Create(6, Random.Shared, (span, r) =>
        {
            for (var i = 0; i < span.Length; i++)
            {
                span[i] = chars[r.Next(chars.Length)];
            }
        });
    }
}
