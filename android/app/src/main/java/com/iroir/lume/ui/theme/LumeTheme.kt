package com.iroir.lume.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LumeColors = darkColorScheme(
    primary = Color(0xFFE8DED0),
    background = Color(0xFF08090B),
    surface = Color(0xFF101216),
    onBackground = Color.White,
    onSurface = Color.White,
)

@Composable
fun LumeTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = LumeColors, content = content)
}
