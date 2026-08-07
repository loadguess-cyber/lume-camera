package com.iroir.lume.camera

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RecordingProfilePolicyTest {
    private val policy = RecordingProfilePolicy()
    private val only4k30 = setOf(RecordingProfile(3840, 2160, 30, "video/hevc"))

    @Test
    fun unsupported8k_isRejectedInsteadOfReturning4k() {
        val result = policy.resolve(
            RecordingRequest(7680, 4320, 30),
            only4k30,
        )

        assertTrue(result is ProfileDecision.Rejected)
        assertEquals(only4k30.toList(), (result as ProfileDecision.Rejected).alternatives)
        assertEquals("REQUESTED_PROFILE_UNSUPPORTED", result.reason)
    }

    @Test
    fun exact4k30_isSelected() {
        assertEquals(
            ProfileDecision.Supported(RecordingProfile(3840, 2160, 30, "video/hevc")),
            policy.resolve(RecordingRequest(3840, 2160, 30), only4k30),
        )
    }

    @Test
    fun exactDimensionsAndFpsMayChooseSupportedCodec() {
        val profiles = setOf(
            RecordingProfile(3840, 2160, 30, "video/avc"),
            RecordingProfile(3840, 2160, 30, "video/hevc"),
        )

        assertEquals(
            ProfileDecision.Supported(RecordingProfile(3840, 2160, 30, "video/hevc")),
            policy.resolve(RecordingRequest(3840, 2160, 30, preferredMime = "video/hevc"), profiles),
        )
    }
}
