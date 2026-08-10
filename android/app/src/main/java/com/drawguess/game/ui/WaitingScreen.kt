package com.drawguess.game.ui

import android.content.ClipData
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drawguess.game.data.WordBankParser
import com.drawguess.game.state.GameUiState
import com.drawguess.game.state.GameViewModel
import com.drawguess.game.ui.components.NeoButton
import com.drawguess.game.ui.components.NeoCard
import com.drawguess.game.ui.components.NeoSection
import com.drawguess.game.ui.components.NeoVariant
import com.drawguess.game.ui.components.StatusMessage
import com.drawguess.game.ui.theme.Ink
import com.drawguess.game.ui.theme.Lime
import com.drawguess.game.ui.theme.Orange
import kotlin.math.roundToInt
import kotlinx.coroutines.launch

@Composable
fun WaitingScreen(state: GameUiState, viewModel: GameViewModel) {
    val room = state.room ?: return
    val me = room.players.find { it.id == state.playerId }
    val isHost = me?.isHost == true
    val context = LocalContext.current
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    val sampleWords = remember {
        try {
            context.assets.open("sample_words.txt").bufferedReader().use { it.readText() }
        } catch (_: Exception) {
            ""
        }
    }
    var importInfo by remember { mutableStateOf<String?>(null) }

    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) {
            try {
                val text = context.contentResolver.openInputStream(uri)
                    ?.bufferedReader()?.use { it.readText() } ?: ""
                val parsed = WordBankParser.parse(text)
                if (parsed.words.isEmpty()) {
                    importInfo = "词库中没有可用词汇"
                } else {
                    viewModel.setWordBank(parsed.words)
                    importInfo = "已导入 ${parsed.words.size} 个词" +
                        if (parsed.skippedLines > 0) "，跳过 ${parsed.skippedLines} 行" else ""
                }
            } catch (e: Exception) {
                importInfo = "读取词库失败：${e.message}"
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        StatusMessage(state.statusMessage, modifier = Modifier.fillMaxWidth())

        NeoCard(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text("房间码", fontSize = 11.sp, fontFamily = FontFamily.Monospace, color = Ink.copy(alpha = 0.6f))
                    Text(
                        room.roomId,
                        fontSize = 30.sp,
                        fontWeight = FontWeight.Black,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 6.sp
                    )
                }
                Row {
                    NeoButton(
                        text = "复制",
                        onClick = {
                            scope.launch {
                                clipboard.setClipEntry(
                                    ClipEntry(ClipData.newPlainText("roomCode", room.roomId))
                                )
                            }
                        },
                        variant = NeoVariant.Accent
                    )
                    Spacer(Modifier.width(8.dp))
                    NeoButton(text = "退出", onClick = viewModel::leaveRoom, variant = NeoVariant.Light)
                }
            }
        }

        room.kickVote?.let { vote ->
            NeoCard(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Orange)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "投票踢出 ${vote.targetName}：${vote.yesVotes}/${vote.requiredVotes}（${vote.remainingSeconds}s）",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Black,
                        fontSize = 13.sp
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
        }

        NeoCard(modifier = Modifier.fillMaxWidth()) {
            NeoSection("玩家（${room.players.size}）")
            Spacer(Modifier.height(8.dp))
            room.players.forEachIndexed { index, player ->
                val isMe = player.id == state.playerId
                val canKick = !player.isHost && !isMe
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(2.dp, Ink)
                        .padding(horizontal = 8.dp, vertical = 6.dp)
                        .padding(vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "${index + 1}. ${player.name}",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Black,
                        fontSize = 14.sp,
                        modifier = Modifier.weight(1f)
                    )
                    if (player.isHost) {
                        Badge("房主", Lime)
                    }
                    if (isMe) {
                        Spacer(Modifier.width(4.dp))
                        Badge("我", com.drawguess.game.ui.theme.Cyan)
                    }
                    if (canKick) {
                        Spacer(Modifier.width(8.dp))
                        NeoButton(
                            text = "踢",
                            onClick = { viewModel.voteKick(player.id) },
                            variant = NeoVariant.Warning,
                            modifier = Modifier.padding(0.dp)
                        )
                    }
                }
            }
        }

        NeoCard(modifier = Modifier.fillMaxWidth()) {
            NeoSection("房间设置")
            Spacer(Modifier.height(10.dp))
            if (isHost) {
                Text("游戏模式", fontFamily = FontFamily.Monospace, fontSize = 12.sp, fontWeight = FontWeight.Black)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ModeChip(
                        label = "抢占模式",
                        selected = room.settings.scoreMode == "Preemptive",
                        onClick = { viewModel.updateSettings(scoreMode = "Preemptive") }
                    )
                    ModeChip(
                        label = "递减模式",
                        selected = room.settings.scoreMode == "Decreasing",
                        onClick = { viewModel.updateSettings(scoreMode = "Decreasing") }
                    )
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    "总轮数：${room.settings.totalRounds}",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black
                )
                Slider(
                    value = room.settings.totalRounds.toFloat(),
                    onValueChangeFinished = { /* 值已在拖动中同步 */ },
                    onValueChange = { viewModel.updateSettings(totalRounds = it.roundToInt()) },
                    valueRange = 1f..20f,
                    steps = 18,
                    colors = sliderColors()
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "每轮时间：${room.settings.roundDurationSeconds} 秒",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black
                )
                Slider(
                    value = room.settings.roundDurationSeconds.toFloat(),
                    onValueChange = { viewModel.updateSettings(roundDurationSeconds = (it / 5f).roundToInt() * 5) },
                    onValueChangeFinished = {},
                    valueRange = 15f..300f,
                    steps = 56,
                    colors = sliderColors()
                )
            } else {
                LabeledInfo("模式", if (room.settings.scoreMode == "Preemptive") "抢占" else "递减")
                LabeledInfo("轮数", "${room.settings.totalRounds} 轮")
                LabeledInfo("每轮", "${room.settings.roundDurationSeconds} 秒")
            }
        }

        NeoCard(modifier = Modifier.fillMaxWidth()) {
            NeoSection("词库（${room.wordCount} 个词）")
            Spacer(Modifier.height(10.dp))
            if (isHost) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    NeoButton(
                        text = "导入 TXT 词库",
                        onClick = {
                            importLauncher.launch(arrayOf("text/plain", "text/*", "*/*"))
                        },
                        variant = NeoVariant.Accent
                    )
                    if (sampleWords.isNotBlank()) {
                        NeoButton(
                            text = "载入示例词库",
                            onClick = {
                                val parsed = WordBankParser.parse(sampleWords)
                                if (parsed.words.isEmpty()) {
                                    importInfo = "示例词库解析失败"
                                } else {
                                    viewModel.setWordBank(parsed.words)
                                    importInfo = "已载入 ${parsed.words.size} 个示例词"
                                }
                            },
                            variant = NeoVariant.Light
                        )
                    }
                }
                importInfo?.let {
                    Spacer(Modifier.height(6.dp))
                    Text(it, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    "格式：一行一个词，用 / 分隔别名；# 开头为注释。",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    color = Ink.copy(alpha = 0.6f)
                )
            } else {
                Text(
                    "由房主在等待界面导入，词库对所有人可见。",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 13.sp
                )
            }
        }

        if (isHost) {
            NeoButton(
                text = "开始游戏（至少 2 人）",
                onClick = viewModel::startGame,
                enabled = room.players.size >= 2 && room.wordCount > 0,
                variant = NeoVariant.Primary,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun Badge(text: String, color: Color) {
    Box(
        modifier = Modifier
            .background(color)
            .border(1.dp, Ink)
            .padding(horizontal = 5.dp, vertical = 1.dp)
    ) {
        Text(text, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Black, fontSize = 11.sp)
    }
}

@Composable
private fun ModeChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .background(if (selected) Lime else Color.White)
            .border(2.dp, Ink)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 7.dp)
    ) {
        Text(
            label,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Black,
            fontSize = 13.sp
        )
    }
}

@Composable
private fun LabeledInfo(label: String, value: String) {
    Text(
        text = "$label：$value",
        fontFamily = FontFamily.Monospace,
        fontSize = 13.sp,
        modifier = Modifier.padding(vertical = 2.dp)
    )
}

@Composable
private fun sliderColors() = SliderDefaults.colors(
    thumbColor = Ink,
    activeTrackColor = Ink,
    inactiveTrackColor = Ink.copy(alpha = 0.2f),
    activeTickColor = Ink,
    inactiveTickColor = Ink.copy(alpha = 0.3f)
)
