namespace DrawGuess.Server.Hubs.Models;

public sealed record DrawActionDto(string Type, string StrokeId, float X, float Y, string Color, int Size);
