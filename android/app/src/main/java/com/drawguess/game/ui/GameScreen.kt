package com.drawguess.game.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drawguess.game.net.Dtos
import com.drawguess.game.state.DRAW_COLORS
import com.drawguess.game.state.DRAW_SIZES
import com.drawguess.game.state.GameUiState
import com.drawguess.game.state.GameViewModel
import com.drawguess.game.state.Tool
import com.drawguess.game.ui.components.DrawingCanvas
import com.drawguess.game.ui.components.NeoButton
import com.drawguess.game.ui.components.NeoVariant
import com.drawguess.game.ui.components.StatusMessage
import com.drawguess.game.ui.theme.Cyan
import com.drawguess.game.ui.theme.Ink
import com.drawguess.game.ui.theme.Lime
import com.drawguess.game.ui.theme.Orange
import com.drawguess.game.ui.theme.Pink

private enum class GameTab { Chat, Scores }

@Composable
fun GameScreen(state: GameUiState, viewModel: GameViewModel) {
    val room = state.room ?: return
    val isPainter = room.currentDrawerId == state.playerId
    val roundActive = room.state == "RoundActive"
    val bottomPanelHeight = if (isPainter) 120.dp else 220.dp
    var tab by remember { mutableStateOf(GameTab.Chat) }
    var input by remember { mutableStateOf("") }
    val tool = remember { mutableStateOf(Tool()) }
    val strokeList = viewModel.strokes.toList()

    // 最后 5 秒倒计时音效（每秒变化触发一次）
    LaunchedEffect(room.remainingSeconds, room.currentRound, room.state) {
        if (roundActive && room.remainingSeconds in 1..5) {
            viewModel.sounds.tick()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .safeDrawingPadding()
            .padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        StatusMessage(state.statusMessage, modifier = Modifier.fillMaxWidth())

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .border(2.dp, Ink)
                .background(Color.White)
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    "#${room.roomId} · 第 ${room.currentRound}/${room.totalRounds} 轮",
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Black,
                    fontSize = 13.sp
                )
                Text(
                    if (room.settings.scoreMode == "Preemptive") "抢占模式" else "递减模式",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    color = Ink.copy(alpha = 0.6f)
                )
            }
            Text(
                text = if (room.state == "RoundEnding") "揭晓" else "${room.remainingSeconds}s",
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Black,
                fontSize = 26.sp,
                color = if (roundActive && room.remainingSeconds <= 10) Pink else Ink
            )
            Spacer(Modifier.width(10.dp))
            NeoButton(
                text = "音效 ${if (state.soundEnabled) "开" else "关"}",
                onClick = viewModel::toggleSound,
                variant = if (state.soundEnabled) NeoVariant.Accent else NeoVariant.Light
            )
            Spacer(Modifier.width(6.dp))
            NeoButton(text = "退出", onClick = viewModel::leaveRoom, variant = NeoVariant.Light)
        }

        room.kickVote?.let { vote ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(2.dp, Ink)
                    .background(Orange)
                    .padding(horizontal = 10.dp, vertical = 7.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    "投票踢出 ${vote.targetName}：${vote.yesVotes}/${vote.requiredVotes}（${vote.remainingSeconds}s）",
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Black,
                    fontSize = 12.sp,
                    modifier = Modifier.weight(1f)
                )
                if (vote.targetId != state.playerId) {
                    NeoButton(
                        text = "同意",
                        onClick = { viewModel.voteKick(vote.targetId) },
                        variant = NeoVariant.Dark
                    )
                }
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .border(2.dp, Ink)
                .background(Color.White)
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            when {
                isPainter -> {
                    Text(
                        text = "你的词：",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 13.sp,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        text = state.word ?: "…",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Black,
                        fontSize = 18.sp
                    )
                    if (state.aliases.isNotEmpty()) {
                        Spacer(Modifier.width(6.dp))
                        Text(
                            text = "别名：${state.aliases.joinToString(" / ")}",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            color = Ink.copy(alpha = 0.6f),
                            modifier = Modifier.weight(1f)
                        )
                    } else {
                        Spacer(Modifier.weight(1f))
                    }
                    if (roundActive) {
                        Spacer(Modifier.width(8.dp))
                        NeoButton(
                            text = "提示：${(state.word ?: "").length} 个字",
                            onClick = { viewModel.sendHint("${(state.word ?: "").length} 个字") },
                            variant = NeoVariant.Accent
                        )
                    }
                }
                room.state == "RoundEnding" -> {
                    Text(
                        text = "答案是：${room.lastRound?.answer ?: "…"}",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Black,
                        fontSize = 17.sp,
                        color = Pink
                    )
                }
                else -> {
                    Text(
                        text = if (roundActive) "画师正在作画…" else "等待下一轮…",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 14.sp
                    )
                }
            }
        }

        if (isPainter && roundActive) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(2.dp, Ink)
                    .background(Color.White)
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    DRAW_COLORS.forEach { color ->
                        val selected = tool.value.color == color
                        Box(
                            modifier = Modifier
                                .size(30.dp)
                                .background(if (color == "#ffffff") Color.White else Color(android.graphics.Color.parseColor(color)))
                                .border(2.dp, Ink)
                                .clickable { tool.value = tool.value.copy(color = color) }
                                .padding(2.dp)
                        ) {
                            if (selected) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .border(3.dp, Cyan)
                                )
                            }
                        }
                    }
                }
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    DRAW_SIZES.forEach { size ->
                        val selected = tool.value.size == size
                        Box(
                            modifier = Modifier
                                .size(30.dp)
                                .background(if (selected) Lime else Color.White)
                                .border(2.dp, Ink)
                                .clickable { tool.value = tool.value.copy(size = size) },
                            contentAlignment = Alignment.Center
                        ) {
                            Box(
                                modifier = Modifier
                                    .size((2f + size * 0.9f).dp)
                                    .background(Ink)
                            )
                        }
                    }
                    Spacer(Modifier.width(4.dp))
                    NeoButton(
                        text = "撤销",
                        onClick = { viewModel.undoStroke(viewModel.strokes.lastOrNull()?.id) },
                        variant = NeoVariant.Light
                    )
                    NeoButton(
                        text = "清空",
                        onClick = viewModel::clearCanvas,
                        variant = NeoVariant.Warning
                    )
                }
            }
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .border(3.dp, Ink)
                .padding(4.dp),
            contentAlignment = Alignment.Center
        ) {
            if (isPainter) {
                // 画师模式：画布保持正方形（消息栏已压缩，尽量占满可用空间）
                BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
                    val side = minOf(maxWidth, maxHeight)
                    DrawingCanvas(
                        strokes = strokeList,
                        interactive = isPainter && roundActive,
                        tool = tool.value,
                        viewport = viewModel.canvasViewport,
                        onViewportChange = viewModel::updateCanvasViewport,
                        onAction = viewModel::onDrawAction,
                        modifier = Modifier.size(side)
                    )
                }
            } else {
                DrawingCanvas(
                    strokes = strokeList,
                    interactive = isPainter && roundActive,
                    tool = tool.value,
                    viewport = viewModel.canvasViewport,
                    onViewportChange = viewModel::updateCanvasViewport,
                    onAction = viewModel::onDrawAction,
                    modifier = Modifier.fillMaxSize()
                )
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .border(2.dp, Ink)
                .background(Color.White),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TabButton("聊天", tab == GameTab.Chat, Modifier.weight(1f)) { tab = GameTab.Chat }
            TabButton("玩家与得分", tab == GameTab.Scores, Modifier.weight(1f)) { tab = GameTab.Scores }
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(bottomPanelHeight)
                .border(2.dp, Ink)
                .background(Color.White)
        ) {
            when (tab) {
                GameTab.Chat -> ChatPanel(state, viewModel, input, { input = it }) { value ->
                    viewModel.sendChat(value)
                    input = ""
                }
                GameTab.Scores -> ScorePanel(state, viewModel)
            }
        }
    }
}

@Composable
private fun TabButton(text: String, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(
        modifier = modifier
            .background(if (selected) Ink else Color.White)
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            color = if (selected) Color.White else Ink,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Black,
            fontSize = 13.sp
        )
    }
}

@Composable
private fun ChatPanel(
    state: GameUiState,
    viewModel: GameViewModel,
    input: String,
    onInputChange: (String) -> Unit,
    onSend: (String) -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 8.dp)
        ) {
            items(state.chatMessages) { message ->
                val color = when (message.kind) {
                    "correct" -> Pink
                    "hint" -> Cyan
                    "system" -> Ink.copy(alpha = 0.55f)
                    else -> Ink
                }
                Text(
                    text = when (message.kind) {
                        "correct" -> "🎉 ${message.playerName} 答对了（+${message.scoreAwarded}）"
                        "hint" -> "💡 ${message.playerName}：${message.text}"
                        "system" -> message.text
                        else -> "${message.playerName}：${message.text}"
                    },
                    color = color,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(vertical = 3.dp)
                )
            }
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = input,
                onValueChange = { onInputChange(it.take(100)) },
                singleLine = true,
                placeholder = { Text("猜词 / 聊天…") },
                shape = RoundedCornerShape(0),
                colors = neoTextFieldColors(),
                modifier = Modifier.weight(1f)
            )
            Spacer(Modifier.width(8.dp))
            NeoButton(
                text = "发送",
                onClick = { onSend(input) },
                variant = NeoVariant.Primary
            )
        }
    }
}

@Composable
private fun ScorePanel(state: GameUiState, viewModel: GameViewModel) {
    val room = state.room ?: return
    val sorted = room.scores.sortedByDescending { it.score }
    LazyColumn(modifier = Modifier.fillMaxSize().padding(8.dp)) {
        items(sorted) { score ->
            val player = room.players.find { it.id == score.playerId }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(2.dp, Ink)
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "${sorted.indexOf(score) + 1}. ${score.name}",
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Black,
                    fontSize = 14.sp,
                    modifier = Modifier.weight(1f)
                )
                Text(
                    "${score.score} 分",
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Black,
                    fontSize = 14.sp,
                    color = Pink
                )
                if (player != null && !player.isHost && player.id != state.playerId) {
                    Spacer(Modifier.width(8.dp))
                    NeoButton(
                        text = "踢",
                        onClick = { viewModel.voteKick(player.id) },
                        variant = NeoVariant.Warning
                    )
                }
            }
        }
    }
}
