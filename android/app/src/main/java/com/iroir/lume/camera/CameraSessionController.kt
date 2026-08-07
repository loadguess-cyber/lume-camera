package com.iroir.lume.camera

import android.Manifest
import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.provider.MediaStore
import androidx.camera.camera2.interop.Camera2CameraInfo
import androidx.camera.core.Camera
import androidx.camera.core.CameraInfo
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.MediaStoreOutputOptions
import androidx.camera.video.PendingRecording
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executor
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.suspendCancellableCoroutine

data class CameraState(
    val boundCameraId: String? = null,
    val activeProfile: RecordingProfile? = null,
    val zoomRatio: Float = 1f,
    val isRecording: Boolean = false,
    val recordingNanos: Long = 0,
    val lastSavedUri: String? = null,
    val error: String? = null,
)

class CameraSessionController(
    private val context: Context,
    private val lifecycleOwner: LifecycleOwner,
    private val previewView: PreviewView,
) {
    private val executor: Executor = ContextCompat.getMainExecutor(context)
    private val mutableState = MutableStateFlow(CameraState())
    val state: StateFlow<CameraState> = mutableState

    private var provider: ProcessCameraProvider? = null
    private var camera: Camera? = null
    private var imageCapture: ImageCapture? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var recording: Recording? = null

    suspend fun bind(cameraId: String, profile: RecordingProfile?) {
        stopRecording()
        val cameraProvider = provider ?: ProcessCameraProvider.getInstance(context).await(executor).also { provider = it }
        val selector = selectorFor(cameraId)
        val preview = Preview.Builder().build().also { it.surfaceProvider = previewView.surfaceProvider }
        val photo = ImageCapture.Builder()
            .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
            .setResolutionSelector(
                ResolutionSelector.Builder()
                    .setResolutionStrategy(ResolutionStrategy.HIGHEST_AVAILABLE_STRATEGY)
                    .build(),
            )
            .build()
        val video = profile?.let {
            if (it.width > 3840 || it.height > 2160 || it.fps > 60) {
                throw UnsupportedCaptureCombination("CameraX real-time path does not claim ${it.label}")
            }
            val recorder = Recorder.Builder()
                .setQualitySelector(QualitySelector.from(qualityFor(it)))
                .build()
            VideoCapture.withOutput(recorder)
        }

        runCatching {
            cameraProvider.unbindAll()
            val useCases = listOfNotNull(preview, photo, video).toTypedArray()
            camera = cameraProvider.bindToLifecycle(lifecycleOwner, selector, *useCases)
            imageCapture = photo
            videoCapture = video
            mutableState.value = CameraState(boundCameraId = cameraId, activeProfile = profile)
        }.onFailure { error ->
            mutableState.value = mutableState.value.copy(error = error.message ?: "CAMERA_BIND_FAILED")
            throw error
        }
    }

    fun setZoomRatio(ratio: Float) {
        val zoom = camera?.cameraInfo?.zoomState?.value ?: return
        val bounded = ratio.coerceIn(zoom.minZoomRatio, zoom.maxZoomRatio)
        camera?.cameraControl?.setZoomRatio(bounded)
        mutableState.value = mutableState.value.copy(zoomRatio = bounded)
    }

    fun capturePhoto() {
        val capture = imageCapture ?: return reportError("PHOTO_CAPTURE_NOT_READY")
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, "LUME_${timestamp()}.jpg")
            put(MediaStore.MediaColumns.MIME_TYPE, "image/jpeg")
            put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/LUME")
        }
        val output = ImageCapture.OutputFileOptions.Builder(
            context.contentResolver,
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            values,
        ).build()
        capture.takePicture(output, executor, object : ImageCapture.OnImageSavedCallback {
            override fun onImageSaved(result: ImageCapture.OutputFileResults) {
                mutableState.value = mutableState.value.copy(lastSavedUri = result.savedUri?.toString(), error = null)
            }

            override fun onError(exception: ImageCaptureException) {
                reportError(exception.message ?: "PHOTO_CAPTURE_FAILED")
            }
        })
    }

    fun startRecording() {
        val capture = videoCapture ?: return reportError("EXACT_VIDEO_PROFILE_NOT_READY")
        if (recording != null) return
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, "LUME_${timestamp()}.mp4")
            put(MediaStore.MediaColumns.MIME_TYPE, "video/mp4")
            put(MediaStore.Video.Media.RELATIVE_PATH, "Movies/LUME")
        }
        val output = MediaStoreOutputOptions.Builder(
            context.contentResolver,
            MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
        ).setContentValues(values).build()
        var pending: PendingRecording = capture.output.prepareRecording(context, output)
        if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            pending = pending.withAudioEnabled()
        }
        recording = pending.start(executor, ::onVideoEvent)
    }

    fun stopRecording() {
        recording?.stop()
        recording = null
    }

    fun close() {
        stopRecording()
        provider?.unbindAll()
    }

    private fun onVideoEvent(event: VideoRecordEvent) {
        when (event) {
            is VideoRecordEvent.Start -> mutableState.value = mutableState.value.copy(isRecording = true, error = null)
            is VideoRecordEvent.Status -> mutableState.value = mutableState.value.copy(recordingNanos = event.recordingStats.recordedDurationNanos)
            is VideoRecordEvent.Finalize -> {
                recording = null
                mutableState.value = mutableState.value.copy(
                    isRecording = false,
                    lastSavedUri = event.outputResults.outputUri.toString(),
                    error = if (event.hasError()) "VIDEO_ERROR_${event.error}" else null,
                )
            }
        }
    }

    @SuppressLint("UnsafeOptInUsageError")
    private fun selectorFor(cameraId: String): CameraSelector = CameraSelector.Builder()
        .addCameraFilter { infos: List<CameraInfo> ->
            infos.filter { runCatching { Camera2CameraInfo.from(it).cameraId == cameraId }.getOrDefault(false) }
        }
        .build()

    private fun qualityFor(profile: RecordingProfile): Quality = when {
        profile.width >= 3840 -> Quality.UHD
        profile.width >= 1920 -> Quality.FHD
        profile.width >= 1280 -> Quality.HD
        else -> Quality.SD
    }

    private fun reportError(message: String) {
        mutableState.value = mutableState.value.copy(error = message)
    }

    private fun timestamp(): String = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
}

private suspend fun <T> com.google.common.util.concurrent.ListenableFuture<T>.await(executor: Executor): T =
    suspendCancellableCoroutine { continuation ->
        addListener({
            runCatching { get() }
                .onSuccess { continuation.resume(it) }
                .onFailure { continuation.resumeWithException(it) }
        }, executor)
        continuation.invokeOnCancellation { cancel(true) }
    }
