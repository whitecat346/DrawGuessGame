package com.drawguess.game.ui.components

import android.graphics.Color as AndroidColor
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke as DrawStroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.IntSize
import com.drawguess.game.net.Dtos
import com.drawguess.game.state.Point
import com.drawguess.game.state.Stroke
import com.drawguess.game.state.Tool
import java.util.UUID
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/**
 * 画布：坐标归一化（0..1），笔画栈由 ViewModel 持有，与 Web 端行为一致。
 */
@Composable
fun DrawingCanvas(
    strokes: List<Stroke>,
    interactive: Boolean,
    tool: Tool,
    onAction: (Dtos.DrawActionDto) -> Unit,
    modifier: Modifier = Modifier
) {
    val currentTool by rememberUpdatedState(tool)
    var strokeId by remember { mutableStateOf<String?>(null) }
    var lastPoint by remember { mutableStateOf<Point?>(null) }

    Box(
        modifier = modifier
            .background(Color.White)
            .pointerInput(interactive) {
                if (!interactive) return@pointerInput
                detectDragGestures(
                    onDragStart = { offset ->
                        val p = normalize(offset, size)
                        val id = UUID.randomUUID().toString()
                        strokeId = id
                        lastPoint = p
                        onAction(
                            action("begin", id, p, currentTool, aspectOf(size))
                        )
                    },
                    onDrag = { change, _ ->
                        val id = strokeId ?: return@detectDragGestures
                        val p = normalize(change.position, size)
                        val previous = lastPoint ?: p
                        if (distance(p, previous) >= 0.002f) {
                            lastPoint = p
                            onAction(action("draw", id, p, currentTool, aspectOf(size)))
                        }
                        change.consume()
                    },
                    onDragEnd = {
                        val id = strokeId
                        if (id != null) {
                            onAction(action("end", id, lastPoint ?: Point(0f, 0f), currentTool, aspectOf(size)))
                        }
                        strokeId = null
                        lastPoint = null
                    },
                    onDragCancel = {
                        strokeId = null
                        lastPoint = null
                    }
                )
            }
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawRect(Color.White)
            for (stroke in strokes) {
                if (stroke.points.isEmpty()) continue
                // 按发送端画布宽高比等比适配（letterbox），跨端查看不拉伸
                val aspect = stroke.aspect
                val scale = min(size.width / aspect, size.height)
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
