package com.iroir.lume.ui.diagnostics

import android.os.Build
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.iroir.lume.camera.CameraCapability

@Composable
fun CameraDiagnosticsScreen(
    capabilities: List<CameraCapability>,
    onRefresh: () -> Unit,
) {
    val clipboard = LocalClipboardManager.current
    val report = diagnosticsReport(capabilities)

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(Color(0xFF08090B)).padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Column(modifier = Modifier.padding(top = 24.dp, bottom = 8.dp)) {
                Text("LUME CAMERA LAB", color = Color.White, style = MaterialTheme.typography.titleLarge)
                Text("${Build.MANUFACTURER} ${Build.MODEL} · Android ${Build.VERSION.RELEASE}", color = Color(0xFF9A9CA2))
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onRefresh) { Text("다시 조회") }
                Button(onClick = { clipboard.setText(AnnotatedString(report)) }) { Text("진단 복사") }
            }
        }
        if (capabilities.isEmpty()) {
            item { Text("카메라 정보를 읽는 중입니다…", color = Color.White) }
        }
        items(capabilities, key = { it.logicalCameraId }) { camera -> CameraCapabilityCard(camera) }
        item { Text("해상도와 FPS는 앱이 임의로 낮추지 않습니다.", color = Color(0xFFE8DED0), modifier = Modifier.padding(bottom = 32.dp)) }
    }
}

@Composable
private fun CameraCapabilityCard(camera: CameraCapability) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF121419)),
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                "CAMERA ${camera.logicalCameraId} · ${if (camera.isBackFacing) "BACK" else "FRONT"}",
                color = Color.White,
                fontWeight = FontWeight.SemiBold,
            )
            Text("Hardware ${camera.hardwareLevel} · Logical ${camera.supportsLogicalMultiCamera}", color = Color(0xFFB7B9C0))
            Text("Focal ${camera.focalLengthsMm.joinToString()} mm", color = Color(0xFFB7B9C0))
            Text("Zoom ${camera.zoomRatioRange.start}–${camera.zoomRatioRange.endInclusive}x", color = Color(0xFFB7B9C0))
            Text("Max JPEG ${camera.maximumJpeg ?: "unknown"}", color = Color(0xFFE8DED0))
            camera.physicalLenses.forEach { lens ->
                Text("Lens ${lens.opticalLabel} · id ${lens.cameraId} · ${lens.focalLengthsMm.joinToString()} mm", color = Color(0xFF8FD3FF))
            }
            camera.recordingProfiles.sortedByDescending { it.width.toLong() * it.height }.forEach { profile ->
                Text(profile.label, color = Color(0xFF9EE6B0))
            }
            Text("AE FPS ${camera.frameRateRanges.joinToString()}", color = Color(0xFF8E9199))
        }
    }
}

internal fun diagnosticsReport(capabilities: List<CameraCapability>): String = buildString {
    appendLine("LUME CAMERA CAPABILITIES")
    appendLine("DEVICE=${Build.MANUFACTURER} ${Build.MODEL}")
    appendLine("ANDROID=${Build.VERSION.RELEASE} SDK=${Build.VERSION.SDK_INT}")
    capabilities.forEach { camera ->
        appendLine("CAMERA=${camera.logicalCameraId} BACK=${camera.isBackFacing} LEVEL=${camera.hardwareLevel}")
        appendLine("FOCAL=${camera.focalLengthsMm} ZOOM=${camera.zoomRatioRange} MAX_JPEG=${camera.maximumJpeg}")
        appendLine("PHYSICAL=${camera.physicalLenses}")
        appendLine("VIDEO=${camera.recordingProfiles.sortedByDescending { it.width.toLong() * it.height }}")
        appendLine("FPS=${camera.frameRateRanges}")
    }
}
