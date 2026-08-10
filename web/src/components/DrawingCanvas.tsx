import { useCallback, useEffect, useRef } from "react";
import type { DrawAction } from "../types";

interface Stroke {
  id: string;
  color: string;
  size: number;
  aspect: number;
  points: { x: number; y: number }[];
}

interface PinchState {
  startDist: number;
  startZoom: number;
  lastCentroid: { x: number; y: number };
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

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

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
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<PinchState | null>(null);

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

    const zoom = zoomRef.current;
    const pan = panRef.current;
    ctx.save();
    ctx.translate(width / 2 + pan.x, height / 2 + pan.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-width / 2, -height / 2);

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
    ctx.restore();
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

  const distance = useCallback((a: { x: number; y: number }, b: { x: number; y: number }) => {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }, []);

  const centroid = useCallback((points: { x: number; y: number }[]) => {
    const sum = points.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
      { x: 0, y: 0 },
    );
    return { x: sum.x / points.length, y: sum.y / points.length };
  }, []);

  const applyZoomAt = useCallback(
    (factor: number, anchor: { x: number; y: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current * factor));
      if (next === zoomRef.current) return;
      const ratio = next / zoomRef.current;
      const cx = anchor.x - rect.left;
      const cy = anchor.y - rect.top;
      const centerX = width / 2;
      const centerY = height / 2;
      panRef.current = {
        x: (cx - centerX) * (1 - ratio) + panRef.current.x * ratio,
        y: (cy - centerY) * (1 - ratio) + panRef.current.y * ratio,
      };
      zoomRef.current = next;
      redraw();
    },
    [redraw],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      applyZoomAt(event.deltaY < 0 ? 1.1 : 1 / 1.1, { x: event.clientX, y: event.clientY });
    };

    const onPointerDown = (event: PointerEvent) => {
      const local = { x: event.clientX, y: event.clientY };
      pointersRef.current.set(event.pointerId, local);

      if (pointersRef.current.size >= 2) {
        // 第二根手指落下：结束当前笔画，进入双指缩放
        if (currentRef.current) {
          sendDrawAction({
            type: "end",
            strokeId: currentRef.current.id,
            x: 0,
            y: 0,
            color: currentRef.current.color,
            size: currentRef.current.size,
            aspect: currentRef.current.aspect,
          });
        }
        drawingRef.current = false;
        currentRef.current = null;
        const points = [...pointersRef.current.values()];
        pinchRef.current = {
          startDist: distance(points[0], points[1]),
          startZoom: zoomRef.current,
          lastCentroid: centroid(points),
        };
        return;
      }

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
      const local = { x: event.clientX, y: event.clientY };
      if (pointersRef.current.has(event.pointerId)) {
        pointersRef.current.set(event.pointerId, local);
      }

      if (pointersRef.current.size >= 2) {
        event.preventDefault();
        const points = [...pointersRef.current.values()];
        const pinch = pinchRef.current;
        if (pinch) {
          const rect = canvas.getBoundingClientRect();
          const width = rect.width;
          const height = rect.height;
          const dist = distance(points[0], points[1]);
          const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinch.startZoom * (dist / pinch.startDist)));
          const c = centroid(points);
          const ratio = nextZoom / zoomRef.current;
          const centerX = width / 2;
          const centerY = height / 2;
          panRef.current = {
            x: (c.x - rect.left - centerX) * (1 - ratio) + panRef.current.x * ratio + (c.x - pinch.lastCentroid.x),
            y: (c.y - rect.top - centerY) * (1 - ratio) + panRef.current.y * ratio + (c.y - pinch.lastCentroid.y),
          };
          pinch.lastCentroid = c;
          zoomRef.current = nextZoom;
          redraw();
        }
        return;
      }

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

    const endPointer = (event: PointerEvent) => {
      pointersRef.current.delete(event.pointerId);
      if (pointersRef.current.size < 2) {
        pinchRef.current = null;
      }
      if (!drawingRef.current || !currentRef.current) return;
      event.preventDefault();
      drawingRef.current = false;
      sendDrawAction({ type: "end", strokeId: currentRef.current.id, x: 0, y: 0, color: currentRef.current.color, size: currentRef.current.size, aspect: currentRef.current.aspect });
      currentRef.current = null;
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);

    const resizeObserver = new ResizeObserver(() => redraw());
    // 观察 canvas 自身：CSS 尺寸（w-full h-full）随容器变化时同步缓冲；
    // 设置 canvas.width/height（attribute）不会改变 CSS 布局，因此不会产生反馈循环。
    resizeObserver.observe(canvas);

    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endPointer);
      canvas.removeEventListener("pointercancel", endPointer);
      resizeObserver.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [active, isPainter, redraw, scheduleRedraw, sendDrawAction, toNormalized, applyZoomAt, distance, centroid]);

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
        // 新回合/清空画布：缩放和平移回归默认
        zoomRef.current = 1;
        panRef.current = { x: 0, y: 0 };
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
      className={`w-full h-full touch-none ${isPainter && active ? "cursor-crosshair" : "cursor-default"}`}
      aria-label="画布"
    />
  );
}
