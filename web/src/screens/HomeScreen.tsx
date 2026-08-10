import { useState } from "react";
import type { Dispatch } from "react";
import { sounds } from "../audio/sounds";
import { Button, Card, Input, NeoTitle } from "../components/ui";
import type { GameApi } from "../hooks/useGameConnection";
import type { GameAction, GameClientState } from "../state/game";

interface HomeScreenProps {
  state: GameClientState;
  api: GameApi;
  dispatch: Dispatch<GameAction>;
}

export function HomeScreen({ state, api, dispatch }: HomeScreenProps) {
  const [nickname, setNickname] = useState(state.nickname);
  const [roomCode, setRoomCode] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [busy, setBusy] = useState(false);

  const play = () => {
    if (state.soundEnabled) sounds.click();
  };

  const saveNickname = (value: string) => {
    setNickname(value);
    localStorage.setItem("dg.nickname", value);
    api.updateNickname(value);
  };

  const handleCreate = async () => {
    play();
    if (!nickname.trim()) {
      dispatch({ type: "error", message: "请输入昵称" });
      return;
    }
    const code = customCode.trim();
    if (code && !/^[A-Z2-9]{6}$/.test(code)) {
      dispatch({ type: "error", message: "房间码需为 6 位字母数字（不含 0、1、I、O）" });
      return;
    }
    setBusy(true);
    const result = await api.createRoom(code || undefined);
    if (result) dispatch({ type: "joined", result });
    setBusy(false);
  };

  const handleJoin = async () => {
    play();
    if (!nickname.trim()) {
      dispatch({ type: "error", message: "请输入昵称" });
      return;
    }
    if (!roomCode.trim()) {
      dispatch({ type: "error", message: "请输入房间码" });
      return;
    }
    setBusy(true);
    const result = await api.joinRoom(roomCode);
    if (result) dispatch({ type: "joined", result });
    setBusy(false);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 px-4 py-8 min-h-full">
      <div className="bg-[#ff006e] text-black border-2 md:border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] md:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] px-6 py-8 md:px-12 md:py-12 text-center w-full max-w-2xl">
        <NeoTitle className="text-4xl md:text-6xl lg:text-7xl">
          你画我猜
        </NeoTitle>
        <p className="font-mono text-sm md:text-base mt-3 max-w-xl mx-auto">
          DRAW &amp; GUESS — 画得快，猜得准，抢答要手快。
        </p>
      </div>

      <Card className="w-full max-w-xl space-y-4">
        <div className="space-y-2">
          <label className="font-black text-sm md:text-base block" htmlFor="nickname">
            你的昵称
          </label>
          <Input
            id="nickname"
            value={nickname}
            maxLength={20}
            placeholder="例如：小白"
            onChange={(e) => saveNickname(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="font-black text-sm md:text-base block" htmlFor="customCode">
            自定义房间码（可选）
          </label>
          <Input
            id="customCode"
            value={customCode}
            maxLength={6}
            placeholder="不填则随机生成 6 位房间码"
            className="uppercase tracking-widest"
            onChange={(e) => setCustomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button variant="primary" onClick={handleCreate} disabled={busy} className="w-full">
            创建房间
          </Button>
          <div className="flex gap-2 min-w-0">
            <Input
              value={roomCode}
              maxLength={6}
              placeholder="房间码"
              className="flex-1 min-w-0 uppercase tracking-widest"
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            />
            <Button variant="dark" onClick={handleJoin} disabled={busy}>
              加入
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between border-2 md:border-4 border-black p-3">
          <span className="font-mono text-xs md:text-sm">音效</span>
          <Button
            variant={state.soundEnabled ? "accent" : "light"}
            className="px-3 py-1 text-xs"
            onClick={() => {
              const next = !state.soundEnabled;
              localStorage.setItem("dg.sound", next ? "on" : "off");
              dispatch({ type: "toggleSound" });
              if (next) sounds.click();
            }}
          >
            {state.soundEnabled ? "开" : "关"}
          </Button>
        </div>
      </Card>

      <p className="font-mono text-xs md:text-sm text-neutral-800 text-center max-w-md">
        房主在等待界面导入 TXT 词库（一行一词，/ 分隔别名），
        设置轮数与时间后即可开局。
      </p>
    </div>
  );
}
