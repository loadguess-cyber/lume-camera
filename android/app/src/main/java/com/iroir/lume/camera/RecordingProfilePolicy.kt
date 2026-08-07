package com.iroir.lume.camera

class RecordingProfilePolicy {
    fun resolve(
        request: RecordingRequest,
        capabilities: Set<RecordingProfile>,
    ): ProfileDecision {
        val exact = capabilities
            .filter { it.width == request.width && it.height == request.height && it.fps == request.fps }
            .sortedWith(compareByDescending<RecordingProfile> { it.mime == request.preferredMime }.thenBy { it.mime })
            .firstOrNull()

        if (exact != null) return ProfileDecision.Supported(exact)

        val alternatives = capabilities.sortedWith(
            compareByDescending<RecordingProfile> { it.width.toLong() * it.height }
                .thenByDescending { it.fps }
                .thenBy { it.mime },
        )
        return ProfileDecision.Rejected(
            requested = request,
            alternatives = alternatives,
            reason = "REQUESTED_PROFILE_UNSUPPORTED",
        )
    }
}
