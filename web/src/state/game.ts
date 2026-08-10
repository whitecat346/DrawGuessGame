import type { ChatMessage, GameStateSnapshot, JoinResult } from "../types";

export type Phase = "home" | "waiting" | "playing" | "ended";
export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

export interface GameClientState {
  phase: Phase;
  nickname: string;
  clientId: string;
  connectionState: ConnectionState;
  playerId?: string;
  room: GameStateSnapshot | null;
  word: { word: string; aliases: string[] } | null;
  messages: ChatMessage[];
  error: string | null;
  soundEnabled: boolean;
}

export type GameAction =
  | { type: "init"; nickname: string; clientId: string; soundEnabled: boolean }
  | { type: "connectionState"; state: ConnectionState }
  | { type: "joined"; result: JoinResult }
  | { type: "state"; room: GameStateSnapshot }
  | { type: "word"; word: string; aliases: string[] }
  | { type: "chat"; message: ChatMessage }
  | { type: "error"; message: string }
  | { type: "kicked"; reason: string }
  | { type: "leave" }
  | { type: "clearError" }
  | { type: "toggleSound" };

function phaseFor(state: GameStateSnapshot): Phase {
  switch (state.state) {
    case "Waiting":
      return "waiting";
    case "RoundActive":
    case "RoundEnding":
      return "playing";
    case "GameOver":
      return "ended";
  }
}

export function initialState(): GameClientState {
  return {
    phase: "home",
    nickname: "",
    clientId: "",
    connectionState: "disconnected",
    room: null,
    word: null,
    messages: [],
    error: null,
    soundEnabled: true,
  };
}

export function gameReducer(state: GameClientState, action: GameAction): GameClientState {
  switch (action.type) {
    case "init":
      return { ...state, nickname: action.nickname, clientId: action.clientId, soundEnabled: action.soundEnabled };
    case "connectionState":
      return { ...state, connectionState: action.state };
    case "joined":
      if (!action.result.success) {
        return { ...state, error: action.result.error ?? "加入失败" };
      }
      return {
        ...state,
        playerId: action.result.playerId,
        room: action.result.state ?? null,
        phase: action.result.state ? phaseFor(action.result.state) : "home",
        messages: action.result.state?.state === "Waiting" ? [] : state.messages,
        error: null,
        word: null,
      };
    case "state":
      return { ...state, room: action.room, phase: phaseFor(action.room) };
    case "word":
      return { ...state, word: { word: action.word, aliases: action.aliases } };
    case "chat":
      return { ...state, messages: [...state.messages.slice(-199), action.message] };
    case "error":
      return { ...state, error: action.message };
    case "kicked":
      return {
        ...initialState(),
        nickname: state.nickname,
        clientId: state.clientId,
        soundEnabled: state.soundEnabled,
        error: action.reason,
      };
    case "leave":
      return {
        ...initialState(),
        nickname: state.nickname,
        clientId: state.clientId,
        soundEnabled: state.soundEnabled,
      };
    case "clearError":
      return { ...state, error: null };
    case "toggleSound":
      return { ...state, soundEnabled: !state.soundEnabled };
  }
}
