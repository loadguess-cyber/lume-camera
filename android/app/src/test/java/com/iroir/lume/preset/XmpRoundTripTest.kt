package com.iroir.lume.preset

import java.nio.charset.StandardCharsets
import org.junit.Assert.assertEquals
import org.junit.Test

class XmpRoundTripTest {
    private val parser = XmpParser()
    private val exporter = XmpExporter()

    @Test
    fun cameraProfileLookTableAndMasks_areReportedUnsupported() {
        val result = parser.parse(resource("xmp/reference-unsupported.xmp"))

        assertEquals(FieldSupport.Unsupported, result.report.getValue("CameraProfile").support)
        assertEquals(FieldSupport.Unsupported, result.report.getValue("LookTableName").support)
        assertEquals(FieldSupport.Unsupported, result.report.getValue("MaskGroupBasedCorrections").support)
    }

    @Test
    fun supportedFieldsSurviveRoundTrip() {
        val first = parser.parse(resource("xmp/reference-supported.xmp")).preset
        val second = parser.parse(exporter.write(first)).preset

        assertEquals(first, second)
    }

    private fun resource(path: String): String = checkNotNull(javaClass.classLoader?.getResourceAsStream(path))
        .readBytes().toString(StandardCharsets.UTF_8)
}
