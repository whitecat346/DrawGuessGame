package com.drawguess.game.state

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.drawguess.game.audio.SoundPlayer
import com.drawguess.game.data.GameRecord
import com.drawguess.game.data.SettingsRepository
import com.drawguess.game.net.Dtos
import com.drawguess.game.net.GameClient
import com.drawguess.game.net.GameEvent
import com.drawguess.game.net.await
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class GameViewModel(application: Application) : AndroidViewModel(application) {

    private val settings = SettingsRepository(application)
    val sounds = SoundPlayer().apply { enabled = settings.soundEnabled }

    var uiState by mutableStateOf(GameUiState())
        private set

    val strokes = mutableStateListOf<Stroke>()

    private var client: GameClient? = null
    private var eventsJob: Job? = null
    private var historyRecorded = false

    init {
        uiState = uiState.copy(
            nickname = settings.nickname,
            serverUrl = settings.serverUrl,
            soundEnabled = settings.soundEnabled,
            history = settings.loadHistory()
        )
    }

    fun updateNickname(value: String) {
        uiState = uiState.copy(nickname = value.take(20))
    }

    fun updateServerUrl(value: String) {
        uiState = uiState.copy(serverUrl = value.trim())
    }

    fun updateRoomCode(value: String) {
        uiState = uiState.copy(roomCode = value.trim().uppercase().take(6))
    }

    fun toggleSound() {
        val next = !uiState.soundEnabled
        settings.soundEnabled = next
        sounds.enabled = next
        uiState = uiState.copy(soundEnabled = next)
        if (next) sounds.click()
    }

    fun createRoom() {
        val name = uiState.nickname.trim()
        if (name.isEmpty()) {
            status("请输入昵称")
            return
        }
        runWithConnection { c ->
            val result = c.createRoom(name, settings.clientId)
            if (result.success) {
                onJoinSuccess(result)
            } else {
                status(result.error ?: "创建房间失败")
            }
        }
    }

    fun joinRoom() {
        val name = uiState.nickname.trim()
        val code = uiState.roomCode.trim()
        if (name.isEmpty()) {
            status("请输入昵称")
            return
        }
        if (code.length != 6) {
            status("请输入 6 位房间码")
            return
        }
        runWithConnection { c ->
            val result = c.joinRoom(code, name, settings.clientId)
            if (result.success) {
                onJoinSuccess(result)
            } else {
                status(result.error ?: "加入房间失败")
            }
        }
    }

    private suspend fun onJoinSuccess(result: Dtos.JoinResultDto) {
        settings.nickname = uiState.nickname.trim()
        withContext(Dispatchers.Main) {
            strokes.clear()
            uiState = uiState.copy(
                connecting = false,
                playerId = result.playerId,
                roomId = result.roomId ?: "",
                room = result.state,
                word = null,
                aliases = emptyList(),
                chatMessages = emptyList(),
                screen = when (result.state?.state) {
                    "RoundActive", "RoundEnding", "GameOver" -> Screen.Game
                    else -> Screen.Waiting
                }
            )
        }
    }

    fun leaveRoom() {
        viewModelScope.launch {
            try {
                client?.leaveRoom()
            } catch (_: Exception) {
                // 忽略断开时的错误
            }
            resetToHome("已退出房间")
        }
    }

    fun startGame() {
        viewModelScope.launch {
            try {
                client?.startGame()
            } catch (e: Exception) {
                status("操作失败：${e.message}")
            }
        }
    }

    fun restartGame() {
        startGameLogic()
    }

    private fun startGameLogic() {
        viewModelScope.launch {
            try {
                client?.restartGame()
            } catch (e: Exception) {
                status("操作失败：${e.message}")
            }
        }
    }

    fun updateSettings(scoreMode: String? = null, totalRounds: Int? = null, roundDurationSeconds: Int? = null) {
        val room = uiState.room ?: return
        val settingsDto = Dtos.RoomSettingsDto().apply {
            this.scoreMode = scoreMode ?: room.settings.scoreMode
            totalRounds?.let { this.totalRounds = it }
            roundDurationSeconds?.let { this.roundDurationSeconds = it }
        }
        if (settingsDto.totalRounds == 0) settingsDto.totalRounds = room.settings.totalRounds
        if (settingsDto.roundDurationSeconds == 0) settingsDto.roundDurationSeconds = room.settings.roundDurationSeconds
        viewModelScope.launch {
            try {
                client?.updateSettings(settingsDto)
            } catch (e: Exception) {
                status("设置失败：${e.message}")
            }
        }
    }

    fun setWordBank(words: List<Dtos.WordEntryDto>) {
        viewModelScope.launch {
            try {
                client?.setWordBank(words)
            } catch (e: Exception) {
                status("词库上传失败：${e.message}")
            }
        }
    }

    fun sendChat(text: String) {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return
        sounds.click()
        viewModelScope.launch {
            try {
                client?.sendChat(trimmed)
            } catch (e: Exception) {
                status("发送失败：${e.message}")
            }
        }
    }

    fun sendHint(text: String) {
        viewModelScope.launch {
            try {
                client?.sendHint(text)
                sounds.click()
            } catch (e: Exception) {
                status("提示失败：${e.message}")
            }
        }
    }

    fun voteKick(targetId: String) {
        sounds.click()
        viewModelScope.launch {
            try {
                client?.voteKick(targetId)
            } catch (e: Exception) {
                status("投票失败：${e.message}")
            }
        }
    }

    // ---- 画布 ----

    fun onDrawAction(action: Dtos.DrawActionDto) {
        when (action.type) {
            "begin" -> {
                if (strokes.none { it.id == action.strokeId }) {
                    strokes.add(
                        Stroke(
                            id = action.strokeId,
                            color = action.color,
                            size = action.size,
                            points = mutableListOf(Point(action.x, action.y))
                        )
                    )
                }
            }
            "draw" -> {
                strokes.find { it.id == action.strokeId }?.points?.add(Point(action.x, action.y))
            }
            "end" -> Unit
        }
        sendDraw(action)
    }

    fun clearCanvas() {
        sounds.click()
        viewModelScope.launch {
            try {
                client?.clearCanvas()
            } catch (e: Exception) {
                status("清空失败：${e.message}")
            }
        }
    }

    fun undoStroke(strokeId: String?) {
        if (strokeId == null) return
        sounds.click()
        viewModelScope.launch {
            try {
                client?.undoStroke(strokeId)
            } catch (e: Exception) {
                status("撤销失败：${e.message}")
            }
        }
    }

    private fun sendDraw(action: Dtos.DrawActionDto) {
        viewModelScope.launch {
            try {
                client?.sendDrawAction(action)
            } catch (e: Exception) {
                status("画布同步失败：${e.message}")
            }
        }
    }

    private fun applyRemoteDraw(action: Dtos.DrawActionDto) {
        when (action.type) {
            "begin" -> {
                if (strokes.none { it.id == action.strokeId }) {
                    strokes.add(
                        Stroke(
                            id = action.strokeId,
                            color = action.color,
                            size = action.size,
                            points = mutableListOf(Point(action.x, action.y))
                        )
                    )
                }
            }
            "draw" -> {
                strokes.find { it.id == action.strokeId }?.points?.add(Point(action.x, action.y))
            }
            "end" -> Unit
        }
    }

    // ---- 事件处理 ----

    private suspend fun handleEvent(event: GameEvent) {
        when (event) {
            is GameEvent.State -> applyRoom(event.room)
            is GameEvent.Word -> uiState = uiState.copy(word = event.word, aliases = event.aliases)
            is GameEvent.Chat -> {
                uiState = uiState.copy(chatMessages = (uiState.chatMessages + event.message).takeLast(200))
                when (event.message.kind) {
                    "correct" -> sounds.correct()
                    "system" -> Unit
                    else -> Unit
                }
            }
            is GameEvent.Draw -> applyRemoteDraw(event.action)
            GameEvent.CanvasCleared -> strokes.clear()
            is GameEvent.StrokeUndone -> strokes.removeAll { it.id == event.strokeId }
            is GameEvent.Kicked -> {
                status("你已被移出：${event.reason}")
                resetToHome()
            }
            is GameEvent.Error -> status(event.message)
            is GameEvent.Closed -> {
                if (uiState.screen != Screen.Home) {
                    status("连接已断开，请重新进入房间")
                    resetToHome()
                }
            }
        }
    }

    private fun applyRoom(room: Dtos.GameStateSnapshotDto) {
        val previous = uiState
        val newScreen = when (room.state) {
            "GameOver" -> Screen.End
            "RoundActive", "RoundEnding" -> Screen.Game
            else -> Screen.Waiting
        }

        val enteringGame = newScreen == Screen.Game && previous.screen != Screen.Game
        val enteringEnd = newScreen == Screen.End && previous.screen != Screen.End

        if (enteringGame) {
            strokes.clear()
            historyRecorded = false
        }
        if (enteringEnd && !historyRecorded) {
            recordHistory(room)
        }
        if (room.state == "Waiting") historyRecorded = false

        uiState = previous.copy(room = room, screen = newScreen)
    }

    private fun recordHistory(room: Dtos.GameStateSnapshotDto) {
        val playerId = uiState.playerId ?: return
        val myScore = room.scores.find { it.playerId == playerId }?.score ?: 0
        val sorted = room.scores.sortedByDescending { it.score }
        val rank = sorted.indexOfFirst { it.playerId == playerId }
        val record = GameRecord(
            dateEpochMillis = System.currentTimeMillis(),
            mode = room.settings.scoreMode,
            rounds = room.totalRounds,
            myScore = myScore,
            rank = if (rank >= 0) rank + 1 else sorted.size,
            playerCount = room.players.size
        )
        settings.addHistory(record)
        historyRecorded = true
        uiState = uiState.copy(history = settings.loadHistory())
    }

    // ---- 连接管理 ----

    private fun runWithConnection(block: suspend (GameClient) -> Unit) {
        val url = uiState.serverUrl.trim().ifEmpty { SettingsRepository.DEFAULT_SERVER_URL }
        viewModelScope.launch {
            uiState = uiState.copy(connecting = true, statusMessage = null)
            try {
                val c = ensureClient(url)
                block(c)
            } catch (e: Exception) {
                status("无法连接服务器：${e.message}")
            } finally {
                withContext(Dispatchers.Main) {
                    uiState = uiState.copy(connecting = false)
                }
            }
        }
    }

    private suspend fun ensureClient(url: String): GameClient {
        val existing = client
        if (existing != null && existing.isConnected) return existing

        eventsJob?.cancel()
        existing?.let {
            try {
                it.disconnect()
            } catch (_: Exception) {
            }
        }

        val newClient = GameClient(url)
        client = newClient
        eventsJob = viewModelScope.launch {
            newClient.events.collect { event ->
                withContext(Dispatchers.Main) {
                    handleEvent(event)
                }
            }
        }
        newClient.connect()
        settings.serverUrl = url
        return newClient
    }

    private suspend fun resetToHome(message: String? = null) {
        try {
            client?.disconnect()
        } catch (_: Exception) {
        }
        eventsJob?.cancel()
        eventsJob = null
        client = null
        strokes.clear()
        uiState = uiState.copy(
            screen = Screen.Home,
            playerId = null,
            room = null,
            roomId = "",
            word = null,
            aliases = emptyList(),
            chatMessages = emptyList(),
            statusMessage = message ?: uiState.statusMessage
        )
    }

    private fun status(message: String) {
        uiState = uiState.copy(statusMessage = message)
    }

    override fun onCleared() {
        sounds.release()
        eventsJob?.cancel()
        viewModelScope.launch {
            try {
                client?.disconnect()
            } catch (_: Exception) {
            }
        }
        super.onCleared()
    }
}
