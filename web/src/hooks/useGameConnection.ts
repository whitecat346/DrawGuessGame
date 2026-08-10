import { useCallback, useRef } from "react";
import * as signalR from "@microsoft/signalr";
import type {
  ChatMessage,
  DrawAction,
  GameStateSnapshot,
  JoinResult,
  RoomSettings,
  WordEntry,
} from "../types";
import type { ConnectionState, GameAction } from "../state/game";

export interface CanvasRemoteHandlers {
  draw: (action: DrawAction) => void;
  clear: () => void;
  undo: (strokeId: string) => void;
}

export type GameApi = ReturnType<typeof useGameConnection>["api"];

export function useGameConnection(dispatch: (action: GameAction) => void) {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const canvasHandlersRef = useRef<CanvasRemoteHandlers | null>(null);
  const identityRef = useRef({ nickname: "玩家", clientId: "anonymous" });

  const setConnectionState = useCallback(
    (state: ConnectionState) => dispatch({ type: "connectionState", state }),
    [dispatch],
  );

  const connect = useCallback(
    async (nickname: string, clientId: string) => {
      identityRef.current = { nickname, clientId };
      dispatch({ type: "init", nickname, clientId, soundEnabled: localStorage.getItem("dg.sound") !== "off" });
      if (connectionRef.current) return;

      const connection = new signalR.HubConnectionBuilder()
        .withUrl("/gamehub")
        .withAutomaticReconnect([0, 2000, 5000, 10000])
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      connection.on("gameStateUpdated", (room: GameStateSnapshot) => dispatch({ type: "state", room }));
      connection.on("wordAssigned", (word: string, aliases: string[]) => dispatch({ type: "word", word, aliases }));
      connection.on("chatReceived", (message: ChatMessage) => dispatch({ type: "chat", message }));
      connection.on("kicked", (reason: string) => dispatch({ type: "kicked", reason }));
      connection.on("error", (message: string) => dispatch({ type: "error", message }));

      connection.on("drawActionReceived", (action: DrawAction) => canvasHandlersRef.current?.draw(action));
      connection.on("canvasCleared", () => canvasHandlersRef.current?.clear());
      connection.on("strokeUndone", (strokeId: string) => canvasHandlersRef.current?.undo(strokeId));

      connection.onreconnecting(() => setConnectionState("reconnecting"));
      connection.onreconnected(() => setConnectionState("connected"));
      connection.onclose(() => setConnectionState("disconnected"));

      connectionRef.current = connection;
      setConnectionState("connecting");
      try {
        await connection.start();
        setConnectionState("connected");
      } catch {
        setConnectionState("disconnected");
      }
    },
    [dispatch, setConnectionState],
  );

  const registerCanvasHandlers = useCallback((handlers: CanvasRemoteHandlers) => {
    canvasHandlersRef.current = handlers;
  }, []);

  const invoke = useCallback(async <T,>(method: string, ...args: unknown[]): Promise<T | undefined> => {
    const connection = connectionRef.current;
    if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
      dispatch({ type: "error", message: "连接未就绪，请稍后重试" });
      return undefined;
    }
    return connection.invoke<T>(method, ...args);
  }, [dispatch]);

  const api = {
    registerCanvasHandlers,
    updateNickname: (name: string) => {
      identityRef.current.nickname = name;
      localStorage.setItem("dg.nickname", name);
    },
    createRoom: () =>
      invoke<JoinResult>("createRoom", identityRef.current.nickname, identityRef.current.clientId),
    joinRoom: (roomId: string) =>
      invoke<JoinResult>("joinRoom", roomId.trim().toUpperCase(), identityRef.current.nickname, identityRef.current.clientId),
    leaveRoom: () => invoke("leaveRoom"),
    updateSettings: (settings: RoomSettings) => invoke("updateSettings", settings),
    setWordBank: (words: WordEntry[]) => invoke("setWordBank", words),
    startGame: () => invoke("startGame"),
    restartGame: () => invoke("restartGame"),
    sendChat: (text: string) => invoke("sendChat", text),
    sendHint: (text: string) => invoke("sendHint", text),
    sendDrawAction: (action: DrawAction) => invoke("sendDrawAction", action),
    clearCanvas: () => invoke("clearCanvas"),
    undoStroke: (strokeId: string) => invoke("undoStroke", strokeId),
    voteKick: (targetPlayerId: string) => invoke("voteKick", targetPlayerId),
  };

  return { connect, api };
}
