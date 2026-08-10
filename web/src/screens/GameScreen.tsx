import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch } from "react";
import { sounds } from "../audio/sounds";
import { DrawingCanvas, type CanvasHandles } from "../components/DrawingCanvas";
import { Button } from "../components/ui";
import type { GameApi } from "../hooks/useGameConnection";
import type { GameAction, GameClientState } from "../state/game";
import type { ChatMessage, DrawAction } from "../types";

interface GameScreenProps {
  state: GameClientState;
  api: GameApi;
  dispatch: Dispatch<GameAction>;
}

const COLORS = ["#000000", "#ff006e", "#ccff00", "#00d9ff", "#ff9500", "#ffffff"];
const SIZES = [3, 8, 15, 30];

export function GameScreen({ state, api, dispatch }: GameScreenProps) {
  const room = state.room;
  const isPainter = room?.currentDrawerId === state.playerId;
  const roundActive = room?.state === "RoundActive";
  const [tool, setTool] = useState({ color: COLORS[0], size: SIZES[1] });
  const [tab, setTab] = useState<"chat" | "players">("chat");
  const canvasApiRef = useRef<CanvasHandles | null>(null);

  const play = () => {
    if (state.soundEnabled) sounds.click();
  };

  if (!room) return null;

  const sendDrawAction = (action: DrawAction) => void api.sendDrawAction(action);
  const clearCanvas = () => {
    play();
    void api.clearCanvas();
  };
  const undoStroke = () => {
    play();
    const lastId = canvasApiRef.current?.getLastStrokeId();
    if (lastId) void api.undoStroke(lastId);
  };

  const hintText = state.word ? `${state.word.word.length} 个字` : "提示";

  return (
    <div className="flex flex-col h-full min-h-0 gap-2 p-2 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-2 md:border-4 border-black bg-white p-2 md:p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center gap-3 font-mono text-xs md:text-sm">
          <span className="font-black text-sm md:text-base">#{room.roomId}</span>
          <span>
            第 {room.currentRound} / {room.totalRounds} 轮
          </span>
          <span className="bg-[#ccff00] px-2 py-0.5 font-black">
            {room.settings.scoreMode === "Preemptive" ? "抢占" : "递减"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`font-black text-2xl md:text-3xl tracking-widest ${room.remainingSeconds <= 10 ? "text-[#ff006e]" : ""}`}
            aria-live="polite"
          >
            {room.state === "RoundEnding" ? "揭晓" : `${room.remainingSeconds}s`}
          </span>
          <Button
            variant={state.soundEnabled ? "accent" : "light"}
            className="px-2 py-1 text-xs"
            onClick={() => {
              const next = !state.soundEnabled;
              localStorage.setItem("dg.sound", next ? "on" : "off");
              dispatch({ type: "toggleSound" });
              if (next) sounds.click();
            }}
          >
            音效 {state.soundEnabled ? "开" : "关"}
          </Button>
          <Button
            variant="light"
            className="px-2 py-1 text-xs"
            onClick={() => {
              play();
              void api.leaveRoom();
              dispatch({ type: "leave" });
            }}
          >
            退出
          </Button>
        </div>
      </div>

      {room.kickVote && (
        <div className="border-2 md:border-4 border-black bg-[#ff9500] p-2 md:p-3 font-mono text-xs md:text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-wrap items-center justify-between gap-2">
          <span>
            投票踢出 <span className="font-black">{room.kickVote.targetName}</span>：
            {room.kickVote.yesVotes}/{room.kickVote.requiredVotes}（{room.kickVote.remainingSeconds}s）
          </span>
          {room.kickVote.targetId !== state.playerId && (
            <Button
              variant="dark"
              className="px-3 py-1 text-xs"
              onClick={() => {
                play();
                void api.voteKick(room.kickVote!.targetId);
              }}
            >
              同意
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-1 min-h-0 flex-col md:flex-row gap-2 md:gap-4">
        <div className="flex flex-1 min-h-0 flex-col gap-2">
          <div className="border-2 md:border-4 border-black bg-white p-2 md:p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between gap-2">
            {isPainter ? (
              <div className="font-mono text-sm md:text-base">
                你的词：<span className="font-black text-lg md:text-2xl">{state.word?.word ?? "…"}</span>
                {state.word && (
                  <span className="text-neutral-800 text-xs md:text-sm ml-2">
                    {state.word.aliases.length > 0 ? `（别名：${state.word.aliases.join(" / ")}）` : ""}
                  </span>
                )}
              </div>
            ) : room.state === "RoundEnding" ? (
              <div className="font-mono text-sm md:text-base">
                答案是：<span className="font-black text-lg md:text-2xl">{room.lastRound?.answer ?? "…"}</span>
              </div>
            ) : (
              <div className="font-mono text-sm md:text-base">
                {roundActive ? "画师正在作画…" : "等待下一轮…"}
              </div>
            )}
            {isPainter && roundActive && (
              <Button
                variant="accent"
                className="px-3 py-1 text-xs"
                onClick={() => {
                  play();
                  void api.sendHint(hintText);
                }}
              >
                发送提示：{hintText}
              </Button>
            )}
          </div>

          {isPainter && roundActive && (
            <div className="border-2 md:border-4 border-black bg-white p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-wrap items-center gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  aria-label={color === "#ffffff" ? "橡皮" : `颜色 ${color}`}
                  className={`h-8 w-8 border-2 border-black transition-all duration-200 ${
                    tool.color === color ? "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -translate-y-[2px]" : ""
                  } ${color === "#ffffff" ? "bg-white" : ""}`}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    play();
                    setTool((t) => ({ ...t, color }));
                  }}
                />
              ))}
              <span className="mx-1 h-6 w-0 border-l-2 border-black" />
              {SIZES.map((size) => (
                <button
                  key={size}
                  aria-label={`笔刷大小 ${size}`}
                  className={`h-8 w-8 border-2 border-black flex items-center justify-center transition-all duration-200 ${
                    tool.size === size ? "bg-[#ccff00]" : "bg-white"
                  }`}
                  onClick={() => {
                    play();
                    setTool((t) => ({ ...t, size }));
                  }}
                >
                  <span
                    className="rounded-none bg-black"
                    style={{ width: Math.max(2, size / 2), height: Math.max(2, size / 2) }}
                  />
                </button>
              ))}
              <span className="mx-1 h-6 w-0 border-l-2 border-black" />
              <Button variant="light" className="px-3 py-1 text-xs" onClick={undoStroke}>
                撤销
              </Button>
              <Button variant="warning" className="px-3 py-1 text-xs" onClick={clearCanvas}>
                清空
              </Button>
            </div>
          )}

          <div className="relative flex-1 min-h-0 border-2 md:border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center overflow-hidden">
            <DrawingCanvas
              active={roundActive}
              isPainter={isPainter}
              sendDrawAction={sendDrawAction}
              registerCanvasHandlers={(handlers) => {
                canvasApiRef.current = handlers;
                api.registerCanvasHandlers(handlers);
              }}
              tool={tool}
            />
          </div>
        </div>

        <div className="flex md:w-80 flex-col min-h-0 md:ml-0">
          <div className="md:hidden grid grid-cols-2 border-2 border-black mb-2">
            <button
              className={`font-black py-2 text-sm transition-all duration-200 ${tab === "chat" ? "bg-black text-white" : "bg-white text-black"}`}
              onClick={() => setTab("chat")}
            >
              聊天
            </button>
            <button
              className={`font-black py-2 text-sm transition-all duration-200 ${tab === "players" ? "bg-black text-white" : "bg-white text-black"}`}
              onClick={() => setTab("players")}
            >
              玩家与得分
            </button>
          </div>
          <div className={`flex-1 min-h-0 ${tab === "chat" ? "flex" : "hidden md:flex"} flex-col`}>
            <ChatPanel state={state} api={api} />
          </div>
          <div className={`flex-1 min-h-0 md:mt-2 ${tab === "players" ? "flex" : "hidden md:flex"} flex-col`}>
            <PlayersPanel state={state} api={api} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatPanel({ state, api }: { state: GameClientState; api: GameApi }) {
  const listRef = useRef<HTMLDivElement>(null);
  const wrongTimerRef = useRef<number | null>(null);
  const isPainter = state.room?.currentDrawerId === state.playerId;
  const roundActive = state.room?.state === "RoundActive";
  const [text, setText] = useState("");

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.messages.length]);

  useEffect(() => {
    const last = state.messages[state.messages.length - 1];
    if (last?.kind === "correct" && wrongTimerRef.current !== null) {
      clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = null;
    }
  }, [state.messages]);

  const send = () => {
    const value = text.trim();
    if (!value) return;
    if (state.soundEnabled) sounds.click();
    // 猜词（非画师且在回合中）：1.5 秒内未收到 correct 则播放答错音效
    if (!isPainter && roundActive) {
      if (wrongTimerRef.current !== null) clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = window.setTimeout(() => {
        wrongTimerRef.current = null;
        if (state.soundEnabled) sounds.wrong();
      }, 1500);
    }
    void api.sendChat(value);
    setText("");
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col border-2 md:border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto p-2 md:p-3 space-y-1.5 font-mono text-sm">
        {state.messages.length === 0 && (
          <p className="text-neutral-800 text-xs">猜中答案会高亮显示，聊天消息所有人可见。</p>
        )}
        {state.messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
      </div>
      <div className="border-t-2 border-black p-2 flex gap-2">
        <input
          value={text}
          maxLength={100}
          placeholder={isPainter ? "和观众聊聊天…" : roundActive ? "输入你的猜测…" : "聊天…"}
          className="flex-1 rounded-none border-2 border-black font-mono px-2 py-1.5 text-sm focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <Button variant="dark" className="px-3 py-1 text-xs" onClick={send}>
          发送
        </Button>
      </div>
    </div>
  );
}

function MessageItem({ message }: { message: ChatMessage }) {
  switch (message.kind) {
    case "system":
      return <p className="text-neutral-800 text-xs">〔系统〕{message.text}</p>;
    case "hint":
      return (
        <p className="bg-[#00d9ff] border-2 border-black px-2 py-1">
          <span className="font-black">提示·{message.playerName}：</span>
          {message.text}
        </p>
      );
    case "correct":
      return (
        <p className="bg-[#ccff00] border-2 border-black px-2 py-1">
          <span className="font-black">{message.playerName} 猜对了！</span>
          <span className="ml-1">{message.text} +{message.scoreAwarded} 分</span>
        </p>
      );
    default:
      return (
        <p>
          <span className="font-black">{message.playerName}：</span>
          {message.text}
        </p>
      );
  }
}

function PlayersPanel({ state, api }: { state: GameClientState; api: GameApi }) {
  const room = state.room;
  const scores = useMemo(() => {
    if (!room) return [];
    const map = new Map(room.scores.map((s) => [s.playerId, s.score]));
    return [...room.players]
      .map((p) => ({ ...p, score: map.get(p.id) ?? 0 }))
      .sort((a, b) => b.score - a.score);
  }, [room]);
  if (!room) return null;

  return (
    <div className="flex-1 min-h-0 flex flex-col border-2 md:border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="border-b-2 border-black p-2 font-black text-sm">玩家与得分</div>
      <ul className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5 font-mono text-sm">
        {scores.map((player, index) => {
          const isPainter = room.currentDrawerId === player.id;
          const canKick = !player.isHost && player.id !== state.playerId;
          return (
            <li key={player.id} className="flex items-center justify-between border-2 border-black p-1.5 md:p-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-black w-5">{index + 1}</span>
                <span className="truncate">{player.name}</span>
                {player.isHost && <span className="bg-black text-white px-1 font-black text-xs">房主</span>}
                {isPainter && <span className="bg-[#ff006e] text-white px-1 font-black text-xs">画师</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-black">{player.score}</span>
                {canKick && (
                  <button
                    className="border-2 border-black bg-[#ff9500] px-1.5 font-black text-xs hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                    onClick={() => {
                      if (state.soundEnabled) sounds.click();
                      void api.voteKick(player.id);
                    }}
                  >
                    踢
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
