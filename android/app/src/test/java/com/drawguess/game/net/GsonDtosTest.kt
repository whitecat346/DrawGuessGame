package com.drawguess.game.net

import com.microsoft.signalr.GsonHubProtocol
import com.microsoft.signalr.InvocationMessage
import java.nio.charset.StandardCharsets
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class GsonDtosTest {

    private val gson: Gson = GsonBuilder().create()

    @Test
    fun `DrawAction 序列化为 camelCase`() {
        val action = Dtos.DrawActionDto().apply {
            type = "begin"
            strokeId = "stroke-1"
            x = 0.25f
            y = 0.5f
            color = "#ff006e"
            size = 8
        }
        val json = gson.toJson(action)
        assertEquals(
            """{"type":"begin","strokeId":"stroke-1","x":0.25,"y":0.5,"color":"#ff006e","size":8}""",
            json
        )
    }

    @Test
    fun `GameState 反序列化`() {
        val json = """
            {
              "roomId":"ABC123",
              "state":"RoundActive",
              "settings":{"scoreMode":"Preemptive","totalRounds":3,"roundDurationSeconds":60},
              "players":[{"id":"p1","name":"小明","isHost":true}],
              "scores":[{"playerId":"p1","name":"小明","score":20}],
              "currentRound":1,
              "totalRounds":3,
              "currentDrawerId":"p1",
              "remainingSeconds":42,
              "wordCount":40,
              "lastRound":null
            }
        """.trimIndent()
        val state = gson.fromJson(json, Dtos.GameStateSnapshotDto::class.java)
        assertNotNull(state)
        assertEquals("ABC123", state.roomId)
        assertEquals("RoundActive", state.state)
        assertEquals("Preemptive", state.settings.scoreMode)
        assertEquals(3, state.settings.totalRounds)
        assertEquals(1, state.players.size)
        assertEquals("小明", state.players[0].name)
        assertEquals(42, state.remainingSeconds)
        assertEquals(20, state.scores[0].score)
    }

    @Test
    fun `InvocationMessage 序列化形状正确`() {
        val action = Dtos.DrawActionDto().apply {
            type = "begin"
            strokeId = "stroke-1"
            x = 0.25f
            y = 0.5f
            color = "#ff006e"
            size = 8
        }
        val message = InvocationMessage(null, null, "SendDrawActionAsync", arrayOf<Any>(action), null)
        val raw = GsonHubProtocol().writeMessage(message)
        val json = String(raw.array(), raw.position(), raw.remaining(), StandardCharsets.UTF_8).trim()
        println(json)
        org.junit.Assert.assertTrue(
            "arguments 必须是对象数组",
            json.contains("\"arguments\":[{\"type\":\"begin\",\"strokeId\":\"stroke-1\"")
        )
        org.junit.Assert.assertTrue(json.contains("\"target\":\"SendDrawActionAsync\""))
    }
}
