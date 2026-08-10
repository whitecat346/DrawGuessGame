package com.drawguess.game.net;

import java.util.List;

/**
 * SignalR DTO 集合（与 docs/protocol.md 一致，字段名保持 camelCase 以便 Gson 直接映射）。
 */
public final class Dtos {

    public static class JoinResultDto {
        public boolean success;
        public String roomId;
        public String playerId;
        public GameStateSnapshotDto state;
        public String error;
    }

    public static class GameStateSnapshotDto {
        public String roomId;
        public String state;
        public RoomSettingsDto settings;
        public List<PlayerInfoDto> players;
        public List<PlayerScoreDto> scores;
        public int currentRound;
        public int totalRounds;
        public String currentDrawerId;
        public int remainingSeconds;
        public int wordCount;
        public KickVoteDto kickVote;
        public RoundSummaryDto lastRound;
    }

    public static class RoomSettingsDto {
        public String scoreMode;
        public int totalRounds;
        public int roundDurationSeconds;
    }

    public static class PlayerInfoDto {
        public String id;
        public String name;
        public boolean isHost;
    }

    public static class PlayerScoreDto {
        public String playerId;
        public String name;
        public int score;
    }

    public static class WordEntryDto {
        public String word;
        public List<String> aliases;
    }

    public static class KickVoteDto {
        public String targetId;
        public String targetName;
        public String initiatorId;
        public int yesVotes;
        public int requiredVotes;
        public int remainingSeconds;
    }

    public static class RoundSummaryDto {
        public int round;
        public String answer;
        public List<String> correctGuesserIds;
        public List<PlayerScoreDto> scores;
    }

    public static class ChatMessageDto {
        public String id;
        public String playerId;
        public String playerName;
        public String text;
        public String kind;
        public int scoreAwarded;
    }

    public static class DrawActionDto {
        public String type;
        public String strokeId;
        public float x;
        public float y;
        public String color;
        public int size;
    }
}
