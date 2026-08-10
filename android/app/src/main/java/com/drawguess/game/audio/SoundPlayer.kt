package com.drawguess.game.audio

import android.media.AudioManager
import android.media.ToneGenerator

/**
 * 系统 ToneGenerator 合成音效，避免素材版权问题。
 */
class SoundPlayer {

    var enabled = true

    private var generator: ToneGenerator? = null

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
    fun correct() = play(ToneGenerator.TONE_PROP_BEEP2, 140)
    fun wrong() = play(ToneGenerator.TONE_SUP_ERROR, 160)
    fun roundEnd() = play(ToneGenerator.TONE_CDMA_ALERT_NETWORK_LITE, 220)

    private fun play(tone: Int, durationMs: Int) {
        if (!enabled) return
        try {
            tone()?.startTone(tone, durationMs)
        } catch (_: Exception) {
            // 某些设备不支持 ToneGenerator，静默忽略
        }
    }

    fun release() {
        generator?.release()
        generator = null
    }
}
