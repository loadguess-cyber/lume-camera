package com.iroir.lume.color

import com.iroir.lume.preset.LumePreset
import org.junit.Assert.assertEquals
import org.junit.Test

class ColorPipelineTest {
    private val pipeline = ColorPipeline()

    @Test
    fun exposureOneStop_doublesLinearLightBeforeToneCurve() {
        val result = pipeline.renderPixel(
            LinearRgb(.18f, .18f, .18f),
            LumePreset.neutral().copy(exposure = 1f),
        )

        assertRgbNear(LinearRgb(.36f, .36f, .36f), result, .002f)
    }

    @Test
    fun neutralPreset_preservesGrayAxis() {
        listOf(.02f, .18f, .5f, .9f).forEach { value ->
            val gray = LinearRgb(value, value, value)
            assertRgbNear(gray, pipeline.renderPixel(gray, LumePreset.neutral()), .001f)
        }
    }

    private fun assertRgbNear(expected: LinearRgb, actual: LinearRgb, tolerance: Float) {
        assertEquals(expected.r, actual.r, tolerance)
        assertEquals(expected.g, actual.g, tolerance)
        assertEquals(expected.b, actual.b, tolerance)
    }
}
