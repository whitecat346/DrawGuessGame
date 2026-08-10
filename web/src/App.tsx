import { useEffect, useReducer } from "react";
import { sounds } from "./audio/sounds";
import { ErrorBanner } from "./components/ui";
import { useGameConnection } from "./hooks/useGameConnection";
import { EndScreen } from "./screens/EndScreen";
import { GameScreen } from "./screens/GameScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { WaitingScreen } from "./screens/WaitingScreen";
import { gameReducer, initialState } from "./state/game";

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, initialState);
  const { connect, api } = useGameConnection(dispatch);

  useEffect(() => {
    const nickname = localStorage.getItem("dg.nickname") ?? "";
    let clientId = localStorage.getItem("dg.clientId");
    if (!clientId) {
      clientId = crypto.randomUUID();
      localStorage.setItem("dg.clientId", clientId);
    }
    void connect(nickname, clientId);
  }, [connect]);

  const lastMessage = state.messages[state.messages.length - 1];
  useEffect(() => {
    if (!state.soundEnabled || !lastMessage) return;
    switch (lastMessage.kind) {
      case "correct":
        sounds.correct();
        break;
      case "hint":
        sounds.hint();
        break;
      case "system":
        if (/轮结束|游戏结束/.test(lastMessage.text)) sounds.roundEnd();
        if (/已被投票移出/.test(lastMessage.text)) sounds.kick();
        break;
    }
  }, [lastMessage, state.soundEnabled]);

  const remaining = state.room?.remainingSeconds;
  useEffect(() => {
    if (state.soundEnabled && remaining !== undefined && remaining > 0 && remaining <= 5) {
      sounds.tick();
    }
  }, [remaining, state.soundEnabled]);

  return (
    <div className="h-full flex flex-col bg-white text-black font-sans">
      {state.connectionState === "reconnecting" && (
        <div className="bg-black text-white font-mono text-xs md:text-sm px-3 py-1 text-center border-b-2 border-black">
          连接中断，正在重连…
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {state.error && (
          <div className="sticky top-0 z-20 p-2">
            <ErrorBanner message={state.error} onClose={() => dispatch({ type: "clearError" })} />
          </div>
        )}
        {state.phase === "home" && <HomeScreen state={state} api={api} dispatch={dispatch} />}
        {state.phase === "waiting" && <WaitingScreen state={state} api={api} dispatch={dispatch} />}
        {state.phase === "playing" && <GameScreen state={state} api={api} dispatch={dispatch} />}
        {state.phase === "ended" && <EndScreen state={state} api={api} dispatch={dispatch} />}
      </div>
    </div>
  );
}
