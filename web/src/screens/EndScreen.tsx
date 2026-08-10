import { useMemo } from "react";
import { sounds } from "../audio/sounds";
import { Button, Card, NeoTitle } from "../components/ui";
import type { GameApi } from "../hooks/useGameConnection";
import type { Dispatch } from "react";
import type { GameAction, GameClientState } from "../state/game";

interface EndScreenProps {
  state: GameClientState;
  api: GameApi;
  dispatch: Dispatch<GameAction>;
}

export function EndScreen({ state, api, dispatch }: EndScreenProps) {
  const room = state.room;
  const me = room?.players.find((p) => p.id === state.playerId);
  const isHost = me?.isHost ?? false;

  const ranking = useMemo(() => {
    if (!room) return [];
    const map = new Map(room.scores.map((s) => [s.playerId, s.score]));
    return [...room.players]
      .map((p) => ({ ...p, score: map.get(p.id) ?? 0 }))
      .sort((a, b) => b.score - a.score);
  }, [room]);

  const play = () => {
    if (state.soundEnabled) sounds.click();
  };

  if (!room) return null;

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-4 min-h-full">
      <div className="bg-black text-white border-2 md:border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] md:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] px-6 py-8 text-center w-full max-w-2xl">
        <NeoTitle className="text-4xl md:text-6xl text-white">游戏结束</NeoTitle>
        <p className="font-mono text-sm mt-2">感谢参与，最终排名如下</p>
      </div>

      <Card className="w-full max-w-2xl">
        <ul className="space-y-2">
          {ranking.map((player, index) => (
            <li
              key={player.id}
              className={`flex items-center justify-between border-2 md:border-4 border-black p-2 md:p-3 ${
                index === 0 ? "bg-[#ccff00]" : index === 1 ? "bg-[#00d9ff]" : index === 2 ? "bg-[#ff9500]" : "bg-white"
              }`}
            >
              <div className="flex items-center gap-3 font-mono text-sm md:text-base">
                <span className="font-black text-lg md:text-2xl">{index + 1}</span>
                <span className="font-black">{player.name}</span>
                {player.id === state.playerId && <span className="bg-black text-white px-2 font-black text-xs">我</span>}
              </div>
              <span className="font-black text-lg md:text-2xl">{player.score}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex gap-3">
        {isHost && (
          <Button
            variant="primary"
            onClick={() => {
              play();
              void api.restartGame();
            }}
          >
            再来一局
          </Button>
        )}
        <Button
          variant="dark"
          onClick={() => {
            play();
            void api.leaveRoom();
            dispatch({ type: "leave" });
          }}
        >
          返回首页
        </Button>
      </div>
    </div>
  );
}
