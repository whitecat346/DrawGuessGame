package com.drawguess.game.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drawguess.game.ui.theme.Ink
import com.drawguess.game.ui.theme.Lime
import com.drawguess.game.ui.theme.Orange
import com.drawguess.game.ui.theme.Pink

enum class NeoVariant { Primary, Accent, Light, Warning, Dark }

@Composable
fun NeoButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: NeoVariant = NeoVariant.Primary,
    enabled: Boolean = true
) {
    val bg = when (variant) {
        NeoVariant.Primary -> Ink
        NeoVariant.Accent -> Lime
        NeoVariant.Light -> Color.White
        NeoVariant.Warning -> Orange
        NeoVariant.Dark -> Ink
    }
    val fg = when (variant) {
        NeoVariant.Accent -> Ink
        NeoVariant.Light -> Ink
        NeoVariant.Warning -> Ink
        else -> Color.White
    }
    Box(
        modifier = modifier
            .padding(bottom = 4.dp)
            .border(2.dp, Ink)
            .background(if (enabled) bg else Color(0xFFBDB9B0))
            .offset(y = if (enabled) 0.dp else 0.dp)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            color = if (enabled) fg else Color(0xFF6B675F),
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Black,
            fontSize = 14.sp
        )
    }
}

@Composable
fun NeoCard(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    Column(
        modifier = modifier
            .border(2.dp, Ink)
            .background(Color.White)
            .padding(12.dp)
    ) {
        content()
    }
}

@Composable
fun NeoSection(
    text: String,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .background(Ink)
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(
            text = text,
            color = Color.White,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Black,
            fontSize = 13.sp
        )
    }
}

@Composable
fun StatusMessage(message: String?, modifier: Modifier = Modifier) {
    if (message != null) {
        Row(
            modifier = modifier
                .fillMaxWidth()
                .background(Pink)
                .border(2.dp, Ink)
                .padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = message,
                color = Color.White,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp
            )
        }
    }
}

@Composable
fun NeoDivider(modifier: Modifier = Modifier) {
    Spacer(modifier = modifier.height(8.dp))
}

@Composable
fun LabeledText(label: String, value: String) {
    Text(
        text = "$label：$value",
        color = Ink,
        fontFamily = FontFamily.Monospace,
        fontSize = 13.sp
    )
}
