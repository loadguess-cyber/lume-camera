package com.iroir.lume.camera

import org.junit.Assert.assertEquals
import org.junit.Test

class CapturePolicyTest {
    @Test
    fun photoPolicy_selectsLargestSupportedJpeg() {
        assertEquals(
            PixelSize(16320, 12240),
            CapturePolicy.maxJpeg(listOf(PixelSize(4000, 3000), PixelSize(16320, 12240))),
        )
    }

    @Test(expected = UnsupportedCaptureCombination::class)
    fun bindRejectsProfileThatWasNotReported() {
        CapturePolicy.requireSupported(
            RecordingProfile(7680, 4320, 30, "video/hevc"),
            setOf(RecordingProfile(3840, 2160, 30, "video/hevc")),
        )
    }
}
