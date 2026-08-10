package com.drawguess.game.audio

import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Handler
import android.os.Looper

/**
 * 系统 ToneGenerator 合成音效，避免素材版权问题。
 */
class SoundPlayer {

    var enabled = true

    private var generator: ToneGenerator? = null
    private val handler = Handler(Looper.getMainLooper())

    private fun tone(): ToneGenerator? {
        if (generator == null) {
            generator = try {
                ToneGenerator(AudioManager.STREAM_MUSIC, 70)
            } catch (_: Exception) {
                null
            }
        }
        return generator
    }

    fun click() = play(ToneGenerator.TONE_PROP_ACK, 50)
    fun tick() = play(ToneGenerator.TONE_PROP_BEEP, 70)
    fun correct() {
        play(ToneGenerator.TONE_PROP_BEEP2, 90)
        playDelayed(ToneGenerator.TONE_PROP_BEEP, 180, 110)
    }
    fun wrong() = play(ToneGenerator.TONE_SUP_ERROR, 160)
    fun roundEnd() {
        play(ToneGenerator.TONE_PROP_BEEP, 100)
        playDelayed(ToneGenerator.TONE_PROP_BEEP2, 220, 140)
    }
    fun kick() {
        play(ToneGenerator.TONE_PROP_NACK, 110)
        playDelayed(ToneGenerator.TONE_SUP_ERROR, 180, 150)
    }
    fun hint() = play(ToneGenerator.TONE_PROP_BEEP2, 80)

    private fun play(tone: Int, durationMs: Int) {
        if (!enabled) return
        try {
            tone()?.startTone(tone, durationMs)
        } catch (_: Exception) {
            // 某些设备不支持 ToneGenerator，静默忽略
        }
    }

    private fun playDelayed(tone: Int, durationMs: Int, delayMs: Long) {
        handler.postDelayed({ play(tone, durationMs) }, delayMs)
    }

    fun release() {
        handler.removeCallbacksAndMessages(null)
        generator?.release()
        generator = null
    }
}
