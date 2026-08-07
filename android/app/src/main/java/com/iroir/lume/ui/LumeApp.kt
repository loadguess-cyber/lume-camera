package com.iroir.lume.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.iroir.lume.camera.CameraCapabilityRepository
import com.iroir.lume.ui.camera.CameraScreen
import com.iroir.lume.ui.diagnostics.CameraDiagnosticsScreen

@Composable
fun LumeApp() {
    val context = LocalContext.current
    val cameraGranted = context.checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
    var refreshKey by remember { mutableIntStateOf(0) }
    var showDiagnostics by remember { mutableStateOf(false) }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        refreshKey++
    }

    if (cameraGranted) {
        val repository = remember(refreshKey) { CameraCapabilityRepository(context.applicationContext) }
        val capabilities by repository.observe().collectAsStateWithLifecycle(initialValue = emptyList())
        if (showDiagnostics) {
            CameraDiagnosticsScreen(capabilities = capabilities, onRefresh = { refreshKey++ })
        } else {
            CameraScreen(capabilities = capabilities, onDiagnostics = { showDiagnostics = true })
        }
        return
    }

    Box(
        modifier = Modifier.fillMaxSize().background(Color(0xFF08090B)),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("LUME NATIVE", color = Color.White)
            Text("고화질 촬영을 위해 카메라 권한이 필요합니다.", color = Color(0xFF9A9CA2))
            Button(onClick = {
                permissionLauncher.launch(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO))
            }) {
                Text("카메라 시작")
            }
        }
    }
}
