package com.iroir.lume.camera

data class PixelSize(val width: Int, val height: Int) {
    val pixels: Long = width.toLong() * height.toLong()
    override fun toString(): String = "${width}×${height}"
}

data class RecordingProfile(
    val width: Int,
    val height: Int,
    val fps: Int,
    val mime: String,
) {
    val label: String = "${width}×${height} · ${fps}fps · ${mime.substringAfter('/')}"
}

data class RecordingRequest(
    val width: Int,
    val height: Int,
    val fps: Int,
    val preferredMime: String? = null,
)

sealed interface ProfileDecision {
    data class Supported(val profile: RecordingProfile) : ProfileDecision
    data class Rejected(
        val requested: RecordingRequest,
        val alternatives: List<RecordingProfile>,
        val reason: String,
    ) : ProfileDecision
}

data class PhysicalLens(
    val cameraId: String,
    val focalLengthsMm: List<Float>,
    val opticalLabel: String,
)

data class CameraCapability(
    val logicalCameraId: String,
    val isBackFacing: Boolean,
    val hardwareLevel: String,
    val physicalLenses: List<PhysicalLens>,
    val focalLengthsMm: List<Float>,
    val zoomRatioRange: ClosedFloatingPointRange<Float>,
    val maximumJpeg: PixelSize?,
    val recordingProfiles: Set<RecordingProfile>,
    val frameRateRanges: List<IntRange>,
    val supportsLogicalMultiCamera: Boolean,
)
