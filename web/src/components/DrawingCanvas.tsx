import { useCallback, useEffect, useRef } from "react";
import type { DrawAction } from "../types";

interface Stroke {
  id: string;
  color: string;
  size: number;
  aspect: number;
  points: { x: number; y: number }[];
}

export interface CanvasHandles {
  draw: (action: DrawAction) => void;
  clear: () => void;
  undo: (strokeId: string) => void;
  getLastStrokeId: () => string | undefined;
}

interface DrawingCanvasProps {
  active: boolean;
  isPainter: boolean;
  sendDrawAction: (action: DrawAction) => void;
  registerCanvasHandlers: (handlers: CanvasHandles) => void;
  tool: { color: string; size: number };
}

export function DrawingCanvas({
  active,
  isPainter,
  sendDrawAction,
  registerCanvasHandlers,
  tool,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Map<string, Stroke>>(new Map());
  const orderRef = useRef<string[]>([]);
  const drawingRef = useRef(false);
  const currentRef = useRef<Stroke | null>(null);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const frameRef = useRef<number | null>(null);
  const getLastStrokeId = useCallback(() => {
    const order = orderRef.current;
    for (let i = order.length - 1; i >= 0; i--) {
      if (strokesRef.current.has(order[i])) return order[i];
    }
    return undefined;
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;
    const dpr = window.devicePixelRatio || 1;
    const containerRect = container.getBoundingClientRect();
    const width = Math.max(1, containerRect.width);
    const height = Math.max(1, containerRect.height);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    // 明确设置 CSS 尺寸，避免 Android 上 canvas 缓冲与布局尺寸不一致导致拉伸
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const id of orderRef.current) {
      const stroke = strokesRef.current.get(id);
      if (!stroke || stroke.points.length === 0) continue;
      // 按发送端画布宽高比等比适配（letterbox），跨端查看不拉伸
      const aspect = stroke.aspect > 0 ? stroke.aspect : width / height;
      const scale = Math.min(width / aspect, height);
      const offsetX = (width - aspect * scale) / 2;
      const offsetY = (height - scale) / 2;
      const mapX = (x: number) => x * aspect * scale + offsetX;
      const mapY = (y: number) => y * scale + offsetY;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = Math.max(1, (stroke.size / 1000) * scale);
      ctx.beginPath();
      ctx.moveTo(mapX(stroke.points[0].x), mapY(stroke.points[0].y));
      for (const point of stroke.points.slice(1)) {
        ctx.lineTo(mapX(point.x), mapY(point.y));
      }
      ctx.stroke();
    }
  }, []);

  const scheduleRedraw = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      redraw();
    });
  }, [redraw]);

  const toNormalized = useCallback((event: PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!active || !isPainter) return;
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      const point = toNormalized(event);
      const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
      const stroke: Stroke = {
        id: crypto.randomUUID(),
        color: toolRef.current.color,
        size: toolRef.current.size,
        aspect,
        points: [point],
      };
      currentRef.current = stroke;
      drawingRef.current = true;
      lastPointRef.current = point;
      strokesRef.current.set(stroke.id, stroke);
      orderRef.current.push(stroke.id);
      sendDrawAction({ type: "begin", strokeId: stroke.id, x: point.x, y: point.y, color: stroke.color, size: stroke.size, aspect });
      redraw();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drawingRef.current || !currentRef.current) return;
      event.preventDefault();
      const point = toNormalized(event);
      const last = lastPointRef.current;
      if (Math.hypot(point.x - last.x, point.y - last.y) < 0.002) return;
      lastPointRef.current = point;
      currentRef.current.points.push(point);
      sendDrawAction({ type: "draw", strokeId: currentRef.current.id, x: point.x, y: point.y, color: currentRef.current.color, size: currentRef.current.size, aspect: currentRef.current.aspect });
      scheduleRedraw();
    };

    const endStroke = (event: PointerEvent) => {
      if (!drawingRef.current || !currentRef.current) return;
      event.preventDefault();
      drawingRef.current = false;
      sendDrawAction({ type: "end", strokeId: currentRef.current.id, x: 0, y: 0, color: currentRef.current.color, size: currentRef.current.size, aspect: currentRef.current.aspect });
      currentRef.current = null;
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endStroke);
    canvas.addEventListener("pointercancel", endStroke);

    const resizeObserver = new ResizeObserver(() => redraw());
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endStroke);
      canvas.removeEventListener("pointercancel", endStroke);
      resizeObserver.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [active, isPainter, redraw, scheduleRedraw, sendDrawAction, toNormalized]);

  useEffect(() => {
    const handlers: CanvasHandles = {
      draw(action) {
        let stroke = strokesRef.current.get(action.strokeId);
        if (action.type === "begin") {
          if (stroke) return;
          stroke = { id: action.strokeId, color: action.color, size: action.size, aspect: action.aspect ?? 0, points: [] };
          strokesRef.current.set(stroke.id, stroke);
          orderRef.current.push(stroke.id);
        }
        if (!stroke) return;
        if (action.type === "begin" || action.type === "draw") {
          stroke.points.push({ x: action.x, y: action.y });
        }
        scheduleRedraw();
      },
      clear() {
        strokesRef.current.clear();
        orderRef.current = [];
        scheduleRedraw();
      },
      undo(strokeId) {
        strokesRef.current.delete(strokeId);
        orderRef.current = orderRef.current.filter((id) => id !== strokeId);
        scheduleRedraw();
      },
      getLastStrokeId,
    };
    registerCanvasHandlers(handlers);
    return () =>
      registerCanvasHandlers({
        draw: () => undefined,
        clear: () => undefined,
        undo: () => undefined,
        getLastStrokeId: () => undefined,
      });
  }, [getLastStrokeId, registerCanvasHandlers, scheduleRedraw]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${isPainter && active ? "cursor-crosshair" : "cursor-default"}`}
      aria-label="画布"
    />
  );
}
