package com.iroir.lume

import org.junit.Assert.assertEquals
import org.junit.Test

class NativeProjectContractTest {
    @Test
    fun packageId_isStable() {
        assertEquals("com.iroir.lume", BuildConfig.APPLICATION_ID)
    }
}
