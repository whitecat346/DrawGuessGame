import { useRef, useState } from "react";
import type { Dispatch } from "react";
import { sounds } from "../audio/sounds";
import { Button, Card, Input, NeoSection } from "../components/ui";
import type { GameApi } from "../hooks/useGameConnection";
import type { GameAction, GameClientState } from "../state/game";
import { parseWordBank } from "../utils/wordBank";

interface WaitingScreenProps {
  state: GameClientState;
  api: GameApi;
  dispatch: Dispatch<GameAction>;
}

export function WaitingScreen({ state, api, dispatch }: WaitingScreenProps) {
  const room = state.room;
  const me = room?.players.find((p) => p.id === state.playerId);
  const isHost = me?.isHost ?? false;
  const fileRef = useRef<HTMLInputElement>(null);
  const [importInfo, setImportInfo] = useState<string | null>(null);

  if (!room) return null;
  const play = () => {
    if (state.soundEnabled) sounds.click();
  };

  const copyRoomCode = async () => {
    play();
    try {
      await navigator.clipboard.writeText(room.roomId);
      dispatch({ type: "error", message: "房间码已复制" });
    } catch {
      dispatch({ type: "error", message: "复制失败，请手动抄写" });
    }
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseWordBank(text);
    if (parsed.words.length === 0) {
      dispatch({ type: "error", message: "词库中没有可用词汇" });
      return;
    }
    await api.setWordBank(parsed.words);
    setImportInfo(`已导入 ${parsed.words.length} 个词${parsed.skippedLines > 0 ? `，跳过 ${parsed.skippedLines} 行` : ""}`);
  };

  const vote = (targetId: string) => {
    play();
    void api.voteKick(targetId);
  };

  return (
    <div className="flex flex-col gap-4 p-3 md:p-6 max-w-5xl mx-auto w-full">
      <Card className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <div className="font-mono text-xs md:text-sm text-gray-700">房间码</div>
          <div className="font-black tracking-[0.3em] text-2xl md:text-4xl">{room.roomId}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="accent" onClick={copyRoomCode}>
            复制房间码
          </Button>
          <Button
            variant="light"
            onClick={() => {
              play();
              void api.leaveRoom();
              dispatch({ type: "leave" });
            }}
          >
            退出房间
          </Button>
        </div>
      </Card>

      {room.kickVote && (
        <Card className="bg-[#ff9500]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-mono text-sm">
              投票踢出 <span className="font-black">{room.kickVote.targetName}</span>
              ：{room.kickVote.yesVotes}/{room.kickVote.requiredVotes}（{room.kickVote.remainingSeconds}s）
            </div>
            {room.kickVote.targetId !== state.playerId && (
              <Button variant="dark" onClick={() => vote(room.kickVote!.targetId)}>
                同意
              </Button>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <NeoSection>玩家（{room.players.length}）</NeoSection>
          <ul className="mt-3 space-y-2">
            {room.players.map((player, index) => {
              const isMe = player.id === state.playerId;
              const canKick = !player.isHost && !isMe && state.playerId !== undefined;
              return (
                <li
                  key={player.id}
                  className="flex items-center justify-between border-2 border-black p-2 md:p-3"
                >
                  <div className="flex items-center gap-2 font-mono text-sm md:text-base">
                    <span className="font-black">{index + 1}.</span>
                    <span>{player.name}</span>
                    {player.isHost && <span className="bg-black text-white px-2 font-black text-xs">房主</span>}
                    {isMe && <span className="bg-[#00d9ff] px-2 font-black text-xs">我</span>}
                  </div>
                  {canKick && (
                    <Button variant="warning" className="px-3 py-1 text-xs" onClick={() => vote(player.id)}>
                      投票踢出
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card>
            <NeoSection>房间设置</NeoSection>
            {isHost ? (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="space-y-1">
                  <span className="font-mono text-xs">游戏模式</span>
                  <select
                    className="rounded-none border-2 md:border-4 border-black font-mono px-2 py-2 w-full bg-white"
                    value={room.settings.scoreMode}
                    onChange={(e) => {
                      play();
                      void api.updateSettings({ ...room.settings, scoreMode: e.target.value as "Preemptive" | "Decreasing" });
                    }}
                  >
                    <option value="Preemptive">抢占模式</option>
                    <option value="Decreasing">递减模式</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="font-mono text-xs">总轮数</span>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={room.settings.totalRounds}
                    onChange={(e) =>
                      void api.updateSettings({ ...room.settings, totalRounds: Number(e.target.value) || 1 })
                    }
                  />
                </label>
                <label className="space-y-1">
                  <span className="font-mono text-xs">每轮时间（秒）</span>
                  <Input
                    type="number"
                    min={15}
                    max={300}
                    step={5}
                    value={room.settings.roundDurationSeconds}
                    onChange={(e) =>
                      void api.updateSettings({ ...room.settings, roundDurationSeconds: Number(e.target.value) || 60 })
                    }
                  />
                </label>
              </div>
            ) : (
              <div className="mt-3 font-mono text-sm space-y-1">
                <p>模式：{room.settings.scoreMode === "Preemptive" ? "抢占" : "递减"}</p>
                <p>轮数：{room.settings.totalRounds} 轮</p>
                <p>每轮：{room.settings.roundDurationSeconds} 秒</p>
              </div>
            )}
          </Card>

          <Card>
            <NeoSection>词库（{room.wordCount} 个词）</NeoSection>
            {isHost ? (
              <div className="mt-3 space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                    e.target.value = "";
                  }}
                />
                <Button variant="accent" onClick={() => {
                  play();
                  fileRef.current?.click();
                }}>
                  导入 TXT 词库
                </Button>
                {importInfo && <p className="font-mono text-xs text-gray-700">{importInfo}</p>}
                <p className="font-mono text-xs text-gray-700">
                  格式：一行一个词，用 / 分隔别名；# 开头为注释。
                </p>
              </div>
            ) : (
              <p className="mt-3 font-mono text-sm">由房主在等待界面导入，词库对所有人可见。</p>
            )}
          </Card>

          {isHost && (
            <Button
              variant="primary"
              className="w-full py-3 text-lg"
              disabled={room.players.length < 2 || room.wordCount === 0}
              onClick={() => {
                play();
                void api.startGame();
              }}
            >
              开始游戏（至少 2 人）
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
