package com.drawguess.game.state

data class Point(val x: Float, val y: Float)

data class Stroke(
    val id: String,
    val color: String,
    val size: Int,
    val points: MutableList<Point>
)

data class Tool(
    val color: String = "#000000",
    val size: Int = 8
)

val DRAW_COLORS = listOf("#000000", "#ff006e", "#ccff00", "#00d9ff", "#ff9500", "#ffffff")
val DRAW_SIZES = listOf(3, 8, 15, 30)
