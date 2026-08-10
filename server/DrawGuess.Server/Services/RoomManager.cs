using System.Collections.Concurrent;
using DrawGuess.Server.Models;

namespace DrawGuess.Server.Services;

public sealed class RoomManager
{
    public const string RoomIdChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private readonly ConcurrentDictionary<string, Room> _rooms = new(StringComparer.OrdinalIgnoreCase);

    public Room CreateRoom(string connectionId, string playerName, string clientId)
    {
        return CreateRoomInternal(connectionId, playerName, clientId, GenerateRoomId());
    }

    public bool TryCreateRoomWithCode(
        string connectionId,
        string playerName,
        string clientId,
        string roomCode,
        out Room room,
        out string? error)
    {
        var normalized = roomCode.Trim().ToUpperInvariant();
        error = ValidateRoomId(normalized);
        if (error is not null)
        {
            room = null!;
            return false;
        }

        if (_rooms.ContainsKey(normalized))
        {
            error = "房间码已被占用，请换一个";
            room = null!;
            return false;
        }

        room = CreateRoomInternal(connectionId, playerName, clientId, normalized);
        return true;
    }

    public static string? ValidateRoomId(string? roomId)
    {
        var normalized = roomId?.Trim().ToUpperInvariant();
        if (string.IsNullOrEmpty(normalized))
        {
            return "房间码不能为空";
        }

        if (normalized.Length != 6)
        {
            return "房间码需为 6 位";
        }

        if (!normalized.All(RoomIdChars.Contains))
        {
            return "房间码只能包含 A-Z、2-9（不含 0、1、I、O）";
        }

        return null;
    }

    private Room CreateRoomInternal(string connectionId, string playerName, string clientId, string roomId)
    {
        var room = new Room { RoomId = roomId };
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
        return string.Create(6, Random.Shared, (span, r) =>
        {
            for (var i = 0; i < span.Length; i++)
            {
                span[i] = RoomIdChars[r.Next(RoomIdChars.Length)];
            }
        });
    }
}
