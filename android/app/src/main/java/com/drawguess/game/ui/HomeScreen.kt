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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLocale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drawguess.game.state.GameUiState
import com.drawguess.game.state.GameViewModel
import com.drawguess.game.ui.components.NeoButton
import com.drawguess.game.ui.components.NeoCard
import com.drawguess.game.ui.components.NeoVariant
import com.drawguess.game.ui.components.StatusMessage
import com.drawguess.game.ui.theme.Ink
import com.drawguess.game.ui.theme.Pink
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun HomeScreen(state: GameUiState, viewModel: GameViewModel) {
    var customCode by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(28.dp))
        Text(
            text = "你画我猜",
            fontSize = 42.sp,
            fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Monospace,
            color = Ink
        )
        Text(
            text = "DRAW & GUESS",
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            color = Ink.copy(alpha = 0.6f),
            modifier = Modifier.padding(bottom = 12.dp)
        )
        StatusMessage(state.statusMessage, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(16.dp))

        NeoCard(modifier = Modifier.fillMaxWidth()) {
            Text("身份", fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = state.nickname,
                onValueChange = viewModel::updateNickname,
                singleLine = true,
                label = { Text("昵称（1-20 字）") },
                shape = RoundedCornerShape(0),
                colors = neoTextFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(10.dp))
            Text("服务器", fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = state.serverUrl,
                onValueChange = viewModel::updateServerUrl,
                singleLine = true,
                label = { Text("SignalR 地址") },
                shape = RoundedCornerShape(0),
                colors = neoTextFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )
            Text(
                text = "模拟器默认 10.0.2.2；真机请填电脑局域网 IP，并把服务端改为 --urls http://0.0.0.0:5197",
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                color = Ink.copy(alpha = 0.6f)
            )
            Spacer(Modifier.height(10.dp))
            Text("自定义房间码（可选，6 位）", fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = customCode,
                onValueChange = { value ->
                    customCode = value.uppercase().filter { it.isLetterOrDigit() }.take(6)
                },
                singleLine = true,
                label = { Text("不填则随机生成") },
                shape = RoundedCornerShape(0),
                colors = neoTextFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )
        }

        Spacer(Modifier.height(16.dp))
        NeoButton(
            text = if (state.connecting) "连接中…" else "创建房间",
            onClick = { viewModel.createRoom(customCode) },
            enabled = !state.connecting,
            variant = NeoVariant.Accent,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(16.dp))

        NeoCard(modifier = Modifier.fillMaxWidth()) {
            Text("加入房间", fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = state.roomCode,
                    onValueChange = viewModel::updateRoomCode,
                    singleLine = true,
                    label = { Text("6 位房间码") },
                    shape = RoundedCornerShape(0),
                    colors = neoTextFieldColors(),
                    modifier = Modifier.weight(1f)
                )
                Spacer(Modifier.width(10.dp))
                NeoButton(
                    text = "加入",
                    onClick = viewModel::joinRoom,
                    enabled = !state.connecting,
                    variant = NeoVariant.Primary
                )
            }
        }

        Spacer(Modifier.height(16.dp))
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Text(
                text = "音效：${if (state.soundEnabled) "开" else "关"}",
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                fontSize = 14.sp,
                modifier = Modifier.weight(1f)
            )
            NeoButton(
                text = if (state.soundEnabled) "关闭" else "开启",
                onClick = viewModel::toggleSound,
                variant = if (state.soundEnabled) NeoVariant.Light else NeoVariant.Accent
            )
        }

        if (state.history.isNotEmpty()) {
            Spacer(Modifier.height(20.dp))
            NeoCard(modifier = Modifier.fillMaxWidth()) {
                Text("最近战绩", fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace, fontSize = 14.sp)
                Spacer(Modifier.height(8.dp))
                val locale = LocalLocale.current
                val formatter = remember { SimpleDateFormat("MM-dd HH:mm", locale.platformLocale) }
                state.history.take(5).forEach { record ->
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
                            text = "第 ${record.rank} 名 · ${record.myScore} 分",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Black
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun neoTextFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = Ink,
    unfocusedBorderColor = Ink,
    cursorColor = Pink,
    focusedLabelColor = Ink,
    unfocusedLabelColor = Ink,
    focusedTextColor = Ink,
    unfocusedTextColor = Ink
)
