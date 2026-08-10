import { useCallback, useEffect, useRef } from "react";
import type { DrawAction } from "../types";

interface Stroke {
  id: string;
  color: string;
  size: number;
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
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

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
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = Math.max(1, (stroke.size / 1000) * height);
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
      for (const point of stroke.points.slice(1)) {
        ctx.lineTo(point.x * width, point.y * height);
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
      const stroke: Stroke = {
        id: crypto.randomUUID(),
        color: toolRef.current.color,
        size: toolRef.current.size,
        points: [point],
      };
      currentRef.current = stroke;
      drawingRef.current = true;
      lastPointRef.current = point;
      strokesRef.current.set(stroke.id, stroke);
      orderRef.current.push(stroke.id);
      sendDrawAction({ type: "begin", strokeId: stroke.id, x: point.x, y: point.y, color: stroke.color, size: stroke.size });
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
      sendDrawAction({ type: "draw", strokeId: currentRef.current.id, x: point.x, y: point.y, color: currentRef.current.color, size: currentRef.current.size });
      scheduleRedraw();
    };

    const endStroke = (event: PointerEvent) => {
      if (!drawingRef.current || !currentRef.current) return;
      event.preventDefault();
      drawingRef.current = false;
      sendDrawAction({ type: "end", strokeId: currentRef.current.id, x: 0, y: 0, color: currentRef.current.color, size: currentRef.current.size });
      currentRef.current = null;
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endStroke);
    canvas.addEventListener("pointercancel", endStroke);

    const resizeObserver = new ResizeObserver(() => redraw());
    resizeObserver.observe(canvas);

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
          stroke = { id: action.strokeId, color: action.color, size: action.size, points: [] };
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
