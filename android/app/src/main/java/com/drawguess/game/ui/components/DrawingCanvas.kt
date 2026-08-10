package com.drawguess.game.ui.components

import android.graphics.Color as AndroidColor
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke as DrawStroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.input.pointer.PointerId
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChanged
import androidx.compose.ui.unit.IntSize
import com.drawguess.game.net.Dtos
import com.drawguess.game.state.CanvasViewport
import com.drawguess.game.state.Point
import com.drawguess.game.state.Stroke
import com.drawguess.game.state.Tool
import java.util.UUID
import kotlin.math.max
import kotlin.math.sqrt

private data class PinchState(
    val startDist: Float,
    val startZoom: Float,
    val lastCentroid: Offset
)

/**
 * 画布：坐标归一化（0..1），笔画栈由 ViewModel 持有。
 * 手势：单指绘制，双指缩放/平移；新回合（清空画布）由 ViewModel 复位视口。
 */
@Composable
fun DrawingCanvas(
    strokes: List<Stroke>,
    interactive: Boolean,
    tool: Tool,
    viewport: CanvasViewport,
    onViewportChange: (zoom: Float, panX: Float, panY: Float) -> Unit,
    onAction: (Dtos.DrawActionDto) -> Unit,
    modifier: Modifier = Modifier
) {
    val currentTool by rememberUpdatedState(tool)
    val currentViewport by rememberUpdatedState(viewport)
    val currentOnViewportChange by rememberUpdatedState(onViewportChange)

    Box(
        modifier = modifier
            .background(Color.White)
            .pointerInput(interactive) {
                if (!interactive) return@pointerInput
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    down.consume()
                    val pointers = mutableMapOf<PointerId, Offset>()
                    pointers[down.id] = down.position
                    var strokeId: String? = null
                    var lastPoint: Point? = null
                    var pinch: PinchState? = null

                    while (true) {
                        val event = awaitPointerEvent()
                        event.changes.forEach { change ->
                            if (change.pressed) {
                                pointers[change.id] = change.position
                            } else {
                                pointers.remove(change.id)
                            }
                        }

                        if (pointers.size >= 2) {
                            // 双指：结束当前笔画，缩放/平移
                            if (strokeId != null) {
                                onAction(action("end", strokeId!!, lastPoint ?: Point(0f, 0f), currentTool, aspectOf(size)))
                                strokeId = null
                                lastPoint = null
                            }
                            val points = pointers.values.toList()
                            val centroid = centroidOf(points)
                            if (pinch == null) {
                                pinch = PinchState(
                                    startDist = distanceOf(points[0], points[1]),
                                    startZoom = currentViewport.zoom,
                                    lastCentroid = centroid
                                )
                            } else {
                                val current = pinch!!
                                val dist = distanceOf(points[0], points[1])
                                val nextZoom = (current.startZoom * (dist / current.startDist)).coerceIn(1f, 5f)
                                val ratio = nextZoom / currentViewport.zoom
                                val center = Offset(size.width / 2f, size.height / 2f)
                                val newPanX =
                                    (centroid.x - center.x) * (1 - ratio) +
                                        currentViewport.panX * ratio +
                                        (centroid.x - current.lastCentroid.x)
                                val newPanY =
                                    (centroid.y - center.y) * (1 - ratio) +
                                        currentViewport.panY * ratio +
                                        (centroid.y - current.lastCentroid.y)
                                pinch = current.copy(lastCentroid = centroid)
                                currentOnViewportChange(nextZoom, newPanX, newPanY)
                            }
                            event.changes.forEach { change ->
                                if (change.positionChanged()) change.consume()
                            }
                        } else if (pointers.size == 1) {
                            pinch = null
                            val change = event.changes.firstOrNull {
                                it.id == pointers.keys.first() && it.pressed
                            }
                            if (change != null) {
                                val point = normalize(change.position, size)
                                if (strokeId == null) {
                                    val id = UUID.randomUUID().toString()
                                    strokeId = id
                                    lastPoint = point
                                    onAction(action("begin", id, point, currentTool, aspectOf(size)))
                                } else {
                                    val previous = lastPoint ?: point
                                    if (distance(point, previous) >= 0.002f) {
                                        lastPoint = point
                                        onAction(action("draw", strokeId!!, point, currentTool, aspectOf(size)))
                                    }
                                }
                                change.consume()
                            }
                        }

                        if (event.changes.all { !it.pressed }) {
                            if (strokeId != null) {
                                onAction(action("end", strokeId!!, lastPoint ?: Point(0f, 0f), currentTool, aspectOf(size)))
                                strokeId = null
                                lastPoint = null
                            }
                            pinch = null
                            break
                        }
                    }
                }
            }
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawRect(Color.White)
            withTransform({
                translate(
                    left = size.width / 2f + viewport.panX,
                    top = size.height / 2f + viewport.panY
                )
                scale(
                    scaleX = viewport.zoom,
                    scaleY = viewport.zoom,
                    pivot = Offset(size.width / 2f, size.height / 2f)
                )
            }) {
                for (stroke in strokes) {
                    if (stroke.points.isEmpty()) continue
                    // 按发送端画布宽高比等比适配（letterbox），跨端查看不拉伸
                    val aspect = stroke.aspect
                    val scale = minOf(size.width / aspect, size.height)
                    val offsetX = (size.width - aspect * scale) / 2f
                    val offsetY = (size.height - scale) / 2f
                    val path = Path().apply {
                        moveTo(
                            stroke.points[0].x * aspect * scale + offsetX,
                            stroke.points[0].y * scale + offsetY
                        )
                        for (point in stroke.points.drop(1)) {
                            lineTo(point.x * aspect * scale + offsetX, point.y * scale + offsetY)
                        }
                    }
                    drawPath(
                        path = path,
                        color = parseColor(stroke.color),
                        style = DrawStroke(
                            width = max(1f, stroke.size / 1000f * scale),
                            cap = StrokeCap.Round,
                            join = StrokeJoin.Round
                        )
                    )
                }
            }
        }
    }
}

private fun normalize(offset: Offset, size: IntSize): Point {
    val w = size.width.coerceAtLeast(1)
    val h = size.height.coerceAtLeast(1)
    return Point(
        x = (offset.x / w).coerceIn(0f, 1f),
        y = (offset.y / h).coerceIn(0f, 1f)
    )
}

private fun distance(a: Point, b: Point): Float =
    sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y))

private fun distanceOf(a: Offset, b: Offset): Float =
    sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y))

private fun centroidOf(points: List<Offset>): Offset =
    Offset(
        x = points.sumOf { it.x.toDouble() }.toFloat() / points.size,
        y = points.sumOf { it.y.toDouble() }.toFloat() / points.size
    )

private fun aspectOf(size: IntSize): Float =
    size.width.toFloat() / size.height.coerceAtLeast(1)

private fun action(
    type: String,
    strokeId: String,
    point: Point,
    tool: Tool,
    aspect: Float
): Dtos.DrawActionDto =
    Dtos.DrawActionDto().apply {
        this.type = type
        this.strokeId = strokeId
        x = point.x
        y = point.y
        color = tool.color
        size = tool.size
        this.aspect = aspect
    }

private fun parseColor(hex: String): Color {
    return try {
        Color(AndroidColor.parseColor(hex))
    } catch (_: Exception) {
        Color.Black
    }
}
