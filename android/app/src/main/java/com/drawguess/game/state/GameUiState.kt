package com.drawguess.game.state

import com.drawguess.game.data.GameRecord
import com.drawguess.game.net.Dtos

enum class Screen { Home, Waiting, Game, End }

data class GameUiState(
    val screen: Screen = Screen.Home,
    val connecting: Boolean = false,
    val statusMessage: String? = null,
    val nickname: String = "",
    val serverUrl: String = "",
    val roomCode: String = "",
    val roomId: String = "",
    val playerId: String? = null,
    val room: Dtos.GameStateSnapshotDto? = null,
    val word: String? = null,
    val aliases: List<String> = emptyList(),
    val chatMessages: List<Dtos.ChatMessageDto> = emptyList(),
    val soundEnabled: Boolean = true,
    val history: List<GameRecord> = emptyList()
)
