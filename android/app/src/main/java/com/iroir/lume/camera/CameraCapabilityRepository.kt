package com.iroir.lume.camera

import android.content.Context
import android.graphics.ImageFormat
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.CamcorderProfile
import android.media.MediaRecorder
import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn

class CameraCapabilityRepository(context: Context) {
    private val cameraManager = context.getSystemService(CameraManager::class.java)

    fun observe(): Flow<List<CameraCapability>> = flow { emit(load()) }.flowOn(Dispatchers.IO)

    fun load(): List<CameraCapability> = cameraManager.cameraIdList.mapNotNull(::readCamera)

    private fun readCamera(cameraId: String): CameraCapability? = runCatching {
        val c = cameraManager.getCameraCharacteristics(cameraId)
        val facing = c.get(CameraCharacteristics.LENS_FACING)
        val focalLengths = c.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)?.toList().orEmpty()
        val zoom = if (Build.VERSION.SDK_INT >= 30) {
            c.get(CameraCharacteristics.CONTROL_ZOOM_RATIO_RANGE)?.let { it.lower..it.upper }
        } else null
        val maxDigital = c.get(CameraCharacteristics.SCALER_AVAILABLE_MAX_DIGITAL_ZOOM) ?: 1f
        val map = c.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
        val maxJpeg = map?.getOutputSizes(ImageFormat.JPEG)
            ?.maxByOrNull { it.width.toLong() * it.height }
            ?.let { PixelSize(it.width, it.height) }
        val fpsRanges = c.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES)
            ?.map { it.lower..it.upper }
            .orEmpty()
        val caps = c.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES)?.toSet().orEmpty()
        val logical = Build.VERSION.SDK_INT >= 28 &&
            CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA in caps
        val physicalIds = if (Build.VERSION.SDK_INT >= 28) c.physicalCameraIds else emptySet()

        CameraCapability(
            logicalCameraId = cameraId,
            isBackFacing = facing == CameraCharacteristics.LENS_FACING_BACK,
            hardwareLevel = hardwareLevelName(c.get(CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL)),
            physicalLenses = physicalIds.map { physicalId -> readPhysicalLens(physicalId, focalLengths) },
            focalLengthsMm = focalLengths,
            zoomRatioRange = zoom ?: (1f..maxDigital),
            maximumJpeg = maxJpeg,
            recordingProfiles = readRecordingProfiles(cameraId, map?.getOutputSizes(MediaRecorder::class.java).orEmpty()),
            frameRateRanges = fpsRanges,
            supportsLogicalMultiCamera = logical,
        )
    }.getOrNull()

    private fun readPhysicalLens(id: String, logicalFocalLengths: List<Float>): PhysicalLens {
        val focal = runCatching {
            cameraManager.getCameraCharacteristics(id)
                .get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)
                ?.toList()
                .orEmpty()
        }.getOrDefault(emptyList())
        val all = (logicalFocalLengths + focal).filter { it > 0f }
        val reference = all.sorted().let { values -> values.getOrNull(values.size / 2) ?: 1f }
        val ratio = (focal.firstOrNull() ?: reference) / reference
        return PhysicalLens(id, focal, formatOpticalLabel(ratio))
    }

    private fun readRecordingProfiles(cameraId: String, sizes: Array<out android.util.Size>): Set<RecordingProfile> {
        val cameraNumber = cameraId.toIntOrNull() ?: return sizes.map {
            RecordingProfile(it.width, it.height, 30, "video/unknown")
        }.toSet()
        val qualities = listOf(
            CamcorderProfile.QUALITY_8KUHD,
            CamcorderProfile.QUALITY_2160P,
            CamcorderProfile.QUALITY_1080P,
            CamcorderProfile.QUALITY_720P,
        )
        return qualities.mapNotNull { quality ->
            if (!CamcorderProfile.hasProfile(cameraNumber, quality)) return@mapNotNull null
            val p = CamcorderProfile.get(cameraNumber, quality)
            RecordingProfile(p.videoFrameWidth, p.videoFrameHeight, p.videoFrameRate, videoMime(p.videoCodec))
        }.toSet()
    }

    private fun hardwareLevelName(level: Int?): String = when (level) {
        CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_LEGACY -> "LEGACY"
        CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_LIMITED -> "LIMITED"
        CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_FULL -> "FULL"
        CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_3 -> "LEVEL_3"
        CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_EXTERNAL -> "EXTERNAL"
        else -> "UNKNOWN"
    }

    private fun videoMime(codec: Int): String = when (codec) {
        MediaRecorder.VideoEncoder.HEVC -> "video/hevc"
        MediaRecorder.VideoEncoder.H264 -> "video/avc"
        MediaRecorder.VideoEncoder.AV1 -> "video/av01"
        else -> "video/unknown"
    }

    private fun formatOpticalLabel(ratio: Float): String {
        val rounded = kotlin.math.round(ratio * 10f) / 10f
        return "${rounded}x"
    }
}
