namespace DrawGuess.Server.Tests;

public sealed class FakeTimeProvider(DateTime startUtc) : TimeProvider
{
    public DateTime NowUtc { get; set; } = startUtc;

    public override DateTimeOffset GetUtcNow() => new(NowUtc);

    public override long GetTimestamp() => NowUtc.Ticks;
}
