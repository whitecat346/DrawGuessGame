using DrawGuess.Server.Hubs.Models;
using DrawGuess.Server.Models;
using DrawGuess.Server.Services;

namespace DrawGuess.Server.Tests;

public class GameEngineTests
{
    [Theory]
    [InlineData("苹果", "苹果", true)]
    [InlineData("苹果", " 苹果 ", true)]
    [InlineData("Apple", "apple", true)]
    [InlineData("Apple", "APPLE", true)]
    [InlineData("苹果", "梨", false)]
    [InlineData("苹果", "苹果派", false)]
    public void MatchesWord_HandlesAliasesAndCase(string word, string guess, bool expected)
    {
        var entry = new WordEntry { Word = word, Aliases = ["apple"] };
        Assert.Equal(expected, GameEngine.MatchesWord(entry, guess));
    }

    [Theory]
    [InlineData(2, 2)]
    [InlineData(3, 2)]
    [InlineData(4, 3)]
    [InlineData(5, 3)]
    [InlineData(8, 5)]
    [InlineData(12, 7)]
    public void RequiredKickVotes_RequiresStrictMajorityWithMinimumTwo(int players, int expected)
    {
        Assert.Equal(expected, GameEngine.RequiredKickVotes(players));
    }

    [Theory]
    [InlineData(60, 60, 100)]
    [InlineData(60, 30, 50)]
    [InlineData(60, 15, 25)]
    [InlineData(60, 1, 1)]
    [InlineData(60, 0, 1)]
    [InlineData(30, 30, 100)]
    public void DecreasingScore_IsProportionalToRemainingTime(int totalSeconds, int remainingSeconds, int expected)
    {
        var total = TimeSpan.FromSeconds(totalSeconds);
        var remaining = TimeSpan.FromSeconds(remainingSeconds);
        Assert.Equal(expected, GameEngine.DecreasingScore(total, remaining));
    }

    [Fact]
    public void NextDrawerIndex_RotatesInFixedOrder()
    {
        var order = new List<string> { "a", "b", "c" };

        Assert.Equal(1, GameEngine.NextDrawerIndex(order, "a", id => true));
        Assert.Equal(2, GameEngine.NextDrawerIndex(order, "b", id => true));
        Assert.Equal(0, GameEngine.NextDrawerIndex(order, "c", id => true));
        Assert.Equal(0, GameEngine.NextDrawerIndex(order, null, id => true));
    }

    [Fact]
    public void NextDrawerIndex_SkipsRemovedPlayersAndWraps()
    {
        var order = new List<string> { "a", "b", "c" };

        Assert.Equal(0, GameEngine.NextDrawerIndex(order, "c", id => id is "a" or "b"));
        Assert.Equal(0, GameEngine.NextDrawerIndex(order, "a", id => id == "a"));
    }

    [Fact]
    public void ValidateSettings_RejectsInvalidValues()
    {
        Assert.False(GameEngine.ValidateSettings(new RoomSettingsDto("Preemptive", 0, 60)).Valid);
        Assert.False(GameEngine.ValidateSettings(new RoomSettingsDto("Preemptive", 3, 10)).Valid);
        Assert.False(GameEngine.ValidateSettings(new RoomSettingsDto("Unknown", 3, 60)).Valid);
        Assert.True(GameEngine.ValidateSettings(new RoomSettingsDto("Decreasing", 5, 120)).Valid);
    }

    [Fact]
    public void ValidateWordBank_RejectsEmptyAndOversizedWords()
    {
        Assert.False(GameEngine.ValidateWordBank([]).Valid);
        Assert.False(GameEngine.ValidateWordBank([new WordEntryDto("", [])]).Valid);
        Assert.False(GameEngine.ValidateWordBank([new WordEntryDto(new string('长', 21), [])]).Valid);
        Assert.True(GameEngine.ValidateWordBank([new WordEntryDto("苹果", ["apple"])]).Valid);
    }

    [Fact]
    public void ValidateDrawAction_RejectsInvalidActions()
    {
        Assert.False(GameEngine.ValidateDrawAction(new DrawActionDto("jump", "s1", 0.5f, 0.5f, "#000000", 4)).Valid);
        Assert.False(GameEngine.ValidateDrawAction(new DrawActionDto("begin", "s1", 5f, 0.5f, "#000000", 4)).Valid);
        Assert.False(GameEngine.ValidateDrawAction(new DrawActionDto("begin", "s1", 0.5f, 0.5f, "#000000", 0)).Valid);
        Assert.True(GameEngine.ValidateDrawAction(new DrawActionDto("draw", "s1", 0.5f, 0.5f, "#000000", 4)).Valid);
    }
}
