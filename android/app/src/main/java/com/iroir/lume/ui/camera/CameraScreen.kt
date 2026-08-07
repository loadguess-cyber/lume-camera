package com.iroir.lume.ui.camera

import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.iroir.lume.camera.CameraCapability
import com.iroir.lume.camera.CameraSessionController
import com.iroir.lume.camera.RecordingProfile

@Composable
fun CameraScreen(
    capabilities: List<CameraCapability>,
    onDiagnostics: () -> Unit,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val backCameras = capabilities.filter { it.isBackFacing }
    var selectedCameraId by remember(backCameras) { mutableStateOf(backCameras.firstOrNull()?.logicalCameraId) }
    val selectedCapability = backCameras.firstOrNull { it.logicalCameraId == selectedCameraId }
    val profiles = selectedCapability?.recordingProfiles.orEmpty().sortedWith(
        compareByDescending<RecordingProfile> { it.width.toLong() * it.height }.thenByDescending { it.fps },
    )
    var selectedProfile by remember(selectedCameraId, profiles) {
        mutableStateOf(profiles.firstOrNull { it.width == 3840 && it.height == 2160 && it.fps <= 30 })
    }
    val previewView = remember { PreviewView(context).apply { scaleType = PreviewView.ScaleType.FILL_CENTER } }
    val controller = remember { CameraSessionController(context.applicationContext, lifecycleOwner, previewView) }
    val state by controller.state.collectAsStateWithLifecycle()

    LaunchedEffect(selectedCameraId, selectedProfile) {
        selectedCameraId?.let { cameraId -> runCatching { controller.bind(cameraId, selectedProfile) } }
    }
    DisposableEffect(Unit) { onDispose { controller.close() } }

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        AndroidView(factory = { previewView }, modifier = Modifier.fillMaxSize())

        Column(
            modifier = Modifier.fillMaxWidth().align(Alignment.TopCenter).background(Color(0x66000000)).padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("LUME · ${selectedProfile?.label ?: "PHOTO ONLY"}", color = Color.White)
                Button(onClick = onDiagnostics) { Text("진단") }
            }
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(backCameras, key = { it.logicalCameraId }) { camera ->
                    FilterChip(
                        selected = camera.logicalCameraId == selectedCameraId,
                        onClick = { selectedCameraId = camera.logicalCameraId },
                        label = { Text(camera.focalLengthsMm.firstOrNull()?.let { "${it}mm" } ?: "CAM ${camera.logicalCameraId}") },
                    )
                }
            }
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(profiles, key = { it.label }) { profile ->
                    FilterChip(
                        selected = profile == selectedProfile,
                        onClick = { selectedProfile = profile },
                        label = { Text(profile.label) },
                    )
                }
            }
        }

        Column(
            modifier = Modifier.fillMaxWidth().align(Alignment.BottomCenter).background(Color(0x9908090B)).padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            val zoomRange = selectedCapability?.zoomRatioRange ?: (1f..1f)
            Text("${"%.1f".format(state.zoomRatio)}x", color = Color.White)
            Slider(
                value = state.zoomRatio.coerceIn(zoomRange.start, zoomRange.endInclusive),
                onValueChange = controller::setZoomRatio,
                valueRange = zoomRange,
                enabled = zoomRange.endInclusive > zoomRange.start,
            )
            state.error?.let { Text(it, color = Color(0xFFFF8A80)) }
            state.lastSavedUri?.let { Text("저장 완료", color = Color(0xFF9EE6B0)) }
            Row(horizontalArrangement = Arrangement.spacedBy(28.dp), verticalAlignment = Alignment.CenterVertically) {
                Button(onClick = controller::capturePhoto) { Text("사진") }
                Button(
                    onClick = { if (state.isRecording) controller.stopRecording() else controller.startRecording() },
                    colors = ButtonDefaults.buttonColors(containerColor = if (state.isRecording) Color.White else Color(0xFFE53935)),
                    modifier = Modifier.size(72.dp),
                    shape = CircleShape,
                    enabled = selectedProfile != null,
                ) {
                    Text(if (state.isRecording) "정지" else "REC", color = if (state.isRecording) Color.Black else Color.White)
                }
            }
        }
    }
}
