package com.drawguess.game.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Ink = Color(0xFF121212)
val Cream = Color(0xFFF4F1EA)
val Lime = Color(0xFFCCFF00)
val Pink = Color(0xFFFF006E)
val Cyan = Color(0xFF00D9FF)
val Orange = Color(0xFFFF9500)

private val LightColors = lightColorScheme(
    primary = Ink,
    onPrimary = Color.White,
    secondary = Lime,
    onSecondary = Ink,
    tertiary = Pink,
    onTertiary = Color.White,
    background = Cream,
    onBackground = Ink,
    surface = Color.White,
    onSurface = Ink,
    surfaceVariant = Lime,
    onSurfaceVariant = Ink,
    error = Pink,
    onError = Color.White
)

@Composable
fun DrawGuessTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColors,
        typography = Typography(),
        content = content
    )
}
