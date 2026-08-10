package com.drawguess.game.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLocale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drawguess.game.state.GameUiState
import com.drawguess.game.state.GameViewModel
import com.drawguess.game.ui.components.NeoButton
import com.drawguess.game.ui.components.NeoCard
import com.drawguess.game.ui.components.NeoSection
import com.drawguess.game.ui.components.NeoVariant
import com.drawguess.game.ui.components.StatusMessage
import com.drawguess.game.ui.theme.Cyan
import com.drawguess.game.ui.theme.Ink
import com.drawguess.game.ui.theme.Lime
import com.drawguess.game.ui.theme.Orange
import com.drawguess.game.ui.theme.Pink
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun EndScreen(state: GameUiState, viewModel: GameViewModel) {
    val room = state.room ?: return
    val me = room.players.find { it.id == state.playerId }
    val isHost = me?.isHost == true
    val sorted = room.scores.sortedByDescending { it.score }
    val locale = LocalLocale.current
    val formatter = remember { SimpleDateFormat("MM-dd HH:mm", locale.platformLocale) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .safeDrawingPadding()
            .verticalScroll(rememberScrollState())
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        StatusMessage(state.statusMessage, modifier = Modifier.fillMaxWidth())

        NeoCard(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = "游戏结束",
                fontSize = 26.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = (if (room.settings.scoreMode == "Preemptive") "抢占模式" else "递减模式") +
                    " · ${room.totalRounds} 轮",
                fontFamily = FontFamily.Monospace,
                fontSize = 13.sp,
                color = Ink.copy(alpha = 0.6f)
            )
            Spacer(Modifier.height(10.dp))
            sorted.forEachIndexed { index, score ->
                val rankColor = when (index) {
                    0 -> Lime
                    1 -> Cyan
                    2 -> Orange
                    else -> Color.White
                }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(rankColor)
                        .border(2.dp, Ink)
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = when (index) {
                            0 -> "🥇"
                            1 -> "🥈"
                            2 -> "🥉"
                            else -> "${index + 1}."
                        },
                        fontSize = 18.sp,
                        modifier = Modifier.width(34.dp)
                    )
                    Text(
                        text = score.name + if (score.playerId == state.playerId) "（我）" else "",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Black,
                        fontSize = 15.sp,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        text = "${score.score} 分",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Black,
                        fontSize = 15.sp,
                        color = Pink
                    )
                }
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            if (isHost) {
                NeoButton(
                    text = "再来一局",
                    onClick = viewModel::restartGame,
                    variant = NeoVariant.Accent,
                    modifier = Modifier.weight(1f)
                )
            }
            NeoButton(
                text = "返回首页",
                onClick = viewModel::leaveRoom,
                variant = NeoVariant.Light,
                modifier = Modifier.weight(1f)
            )
        }

        NeoCard(modifier = Modifier.fillMaxWidth()) {
            NeoSection("历史战绩（最近 ${state.history.size} 场）")
            Spacer(Modifier.height(8.dp))
            state.history.take(10).forEach { record ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = formatter.format(Date(record.dateEpochMillis)),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp
                    )
                    Text(
                        text = "${record.mode} · ${record.rounds}轮 · 第${record.rank}名 · ${record.myScore}分",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Black
                    )
                }
            }
        }
    }
}
