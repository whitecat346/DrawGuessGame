package com.drawguess.game.net

import com.google.gson.GsonBuilder
import com.microsoft.signalr.Action
import com.microsoft.signalr.Action1
import com.microsoft.signalr.Action2
import com.microsoft.signalr.GsonHubProtocol
import com.microsoft.signalr.HubConnection
import com.microsoft.signalr.HubConnectionBuilder
import com.microsoft.signalr.HubConnectionState
import com.microsoft.signalr.OnClosedCallback
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow

sealed interface GameEvent {
    data class State(val room: Dtos.GameStateSnapshotDto) : GameEvent
    data class Word(val word: String, val aliases: List<String>) : GameEvent
    data class Chat(val message: Dtos.ChatMessageDto) : GameEvent
    data class Draw(val action: Dtos.DrawActionDto) : GameEvent
    data object CanvasCleared : GameEvent
    data class StrokeUndone(val strokeId: String) : GameEvent
    data class Kicked(val reason: String) : GameEvent
    data class Error(val message: String) : GameEvent
    data class Closed(val error: String?) : GameEvent
}

/**
 * SignalR Java 客户端封装。
 * 注意：.NET 10 对 Hub 方法名做精确匹配，调用/事件名必须与 docs/protocol.md 完全一致。
 */
class GameClient(private val hubUrl: String) {

    private val _events = MutableSharedFlow<GameEvent>(extraBufferCapacity = 128)
    val events = _events.asSharedFlow()

    private val connection: HubConnection = HubConnectionBuilder.create(hubUrl)
        .withHubProtocol(GsonHubProtocol(GsonBuilder().create()))
        .withServerTimeout(30_000)
        .withKeepAliveInterval(15_000)
        .setHttpClientBuilderCallback { builder ->
            builder.readTimeout(30, TimeUnit.SECONDS)
        }
        .build()

    val isConnected: Boolean
        get() = connection.connectionState == HubConnectionState.CONNECTED

    init {
        connection.on(
            "GameStateUpdatedAsync",
            Action1<Dtos.GameStateSnapshotDto> { room -> _events.tryEmit(GameEvent.State(room)) },
            Dtos.GameStateSnapshotDto::class.java
        )
        connection.on(
            "WordAssignedAsync",
            Action2<String, Array<String>> { word, aliases ->
                _events.tryEmit(GameEvent.Word(word, aliases.toList()))
            },
            String::class.java,
            Array<String>::class.java
        )
        connection.on(
            "ChatReceivedAsync",
            Action1<Dtos.ChatMessageDto> { message -> _events.tryEmit(GameEvent.Chat(message)) },
            Dtos.ChatMessageDto::class.java
        )
        connection.on(
            "DrawActionReceivedAsync",
            Action1<Dtos.DrawActionDto> { action -> _events.tryEmit(GameEvent.Draw(action)) },
            Dtos.DrawActionDto::class.java
        )
        connection.on("CanvasClearedAsync", Action { _events.tryEmit(GameEvent.CanvasCleared) })
        connection.on(
            "StrokeUndoneAsync",
            Action1<String> { strokeId -> _events.tryEmit(GameEvent.StrokeUndone(strokeId)) },
            String::class.java
        )
        connection.on(
            "KickedAsync",
            Action1<String> { reason -> _events.tryEmit(GameEvent.Kicked(reason)) },
            String::class.java
        )
        connection.on(
            "ErrorAsync",
            Action1<String> { message -> _events.tryEmit(GameEvent.Error(message)) },
            String::class.java
        )
        connection.onClosed(OnClosedCallback { exception ->
            _events.tryEmit(GameEvent.Closed(exception?.message))
        })
    }

    suspend fun connect() {
        connection.start().await()
    }

    suspend fun disconnect() {
        if (connection.connectionState == HubConnectionState.DISCONNECTED) return
        connection.stop().await()
    }

    suspend fun createRoom(playerName: String, clientId: String): Dtos.JoinResultDto =
        connection.invoke(Dtos.JoinResultDto::class.java, "CreateRoomAsync", playerName, clientId).await()

    suspend fun createRoomWithCode(playerName: String, clientId: String, roomCode: String): Dtos.JoinResultDto =
        connection.invoke(Dtos.JoinResultDto::class.java, "CreateRoomWithCodeAsync", playerName, clientId, roomCode).await()

    suspend fun joinRoom(roomId: String, playerName: String, clientId: String): Dtos.JoinResultDto =
        connection.invoke(Dtos.JoinResultDto::class.java, "JoinRoomAsync", roomId, playerName, clientId).await()

    fun leaveRoom() = connection.send("LeaveRoomAsync")
    fun updateSettings(settings: Dtos.RoomSettingsDto) = connection.send("UpdateSettingsAsync", settings)
    fun setWordBank(words: List<Dtos.WordEntryDto>) = connection.send("SetWordBankAsync", words)
    fun startGame() = connection.send("StartGameAsync")
    fun restartGame() = connection.send("RestartGameAsync")
    fun sendChat(text: String) = connection.send("SendChatAsync", text)
    fun sendHint(text: String) = connection.send("SendHintAsync", text)
    fun sendDrawAction(action: Dtos.DrawActionDto) = connection.send("SendDrawActionAsync", action)
    fun clearCanvas() = connection.send("ClearCanvasAsync")
    fun undoStroke(strokeId: String) = connection.send("UndoStrokeAsync", strokeId)
    fun voteKick(targetPlayerId: String) = connection.send("VoteKickAsync", targetPlayerId)
}
