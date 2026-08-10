export type GameStateName = "Waiting" | "RoundActive" | "RoundEnding" | "GameOver";
export type ScoreMode = "Preemptive" | "Decreasing";
export type ChatKind = "chat" | "hint" | "system" | "correct";
export type DrawActionType = "begin" | "draw" | "end";

export interface PlayerInfo {
  id: string;
  name: string;
  isHost: boolean;
}

export interface PlayerScore {
  playerId: string;
  name: string;
  score: number;
}

export interface RoomSettings {
  scoreMode: ScoreMode;
  totalRounds: number;
  roundDurationSeconds: number;
}

export interface KickVote {
  targetId: string;
  targetName: string;
  initiatorId: string;
  yesVotes: number;
  requiredVotes: number;
  remainingSeconds: number;
}

export interface RoundSummary {
  round: number;
  answer?: string;
  correctGuesserIds: string[];
  scores: PlayerScore[];
}

export interface GameStateSnapshot {
  roomId: string;
  state: GameStateName;
  settings: RoomSettings;
  players: PlayerInfo[];
  scores: PlayerScore[];
  currentRound: number;
  totalRounds: number;
  currentDrawerId?: string;
  remainingSeconds: number;
  wordCount: number;
  kickVote?: KickVote;
  lastRound?: RoundSummary;
}

export interface JoinResult {
  success: boolean;
  roomId?: string;
  playerId?: string;
  state?: GameStateSnapshot;
  error?: string;
}

export interface WordEntry {
  word: string;
  aliases: string[];
}

export interface ChatMessage {
  id: string;
  playerId?: string;
  playerName: string;
  text: string;
  kind: ChatKind;
  scoreAwarded?: number;
}

export interface DrawAction {
  type: DrawActionType;
  strokeId: string;
  x: number;
  y: number;
  color: string;
  size: number;
  aspect: number;
}
