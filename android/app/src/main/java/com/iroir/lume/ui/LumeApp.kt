package com.iroir.lume.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

@Composable
fun LumeApp() {
    val context = LocalContext.current
    val cameraGranted = context.checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
    Box(
        modifier = Modifier.fillMaxSize().background(Color(0xFF08090B)),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(androidx.compose.ui.unit.Dp(8f))) {
            Text("LUME NATIVE", color = Color.White)
            Text(if (cameraGranted) "CAMERA READY" else "CAMERA PERMISSION REQUIRED", color = Color(0xFF9A9CA2))
        }
    }
}
