package com.iroir.lume.camera

class UnsupportedCaptureCombination(message: String) : IllegalArgumentException(message)

object CapturePolicy {
    fun maxJpeg(sizes: List<PixelSize>): PixelSize? = sizes.maxByOrNull { it.pixels }

    fun requireSupported(
        requested: RecordingProfile,
        supported: Set<RecordingProfile>,
    ): RecordingProfile = supported.firstOrNull {
        it.width == requested.width &&
            it.height == requested.height &&
            it.fps == requested.fps &&
            it.mime == requested.mime
    } ?: throw UnsupportedCaptureCombination("Unsupported exact profile: ${requested.label}")
}
