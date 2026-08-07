package com.iroir.lume.preset

data class CurvePoint(val input: Float, val output: Float)

data class HslAdjustment(
    val hue: Float = 0f,
    val saturation: Float = 0f,
    val luminance: Float = 0f,
)

data class LumePreset(
    val name: String = "Imported XMP",
    val exposure: Float = 0f,
    val contrast: Float = 0f,
    val highlights: Float = 0f,
    val shadows: Float = 0f,
    val whites: Float = 0f,
    val blacks: Float = 0f,
    val temperature: Float = 0f,
    val tint: Float = 0f,
    val clarity: Float = 0f,
    val dehaze: Float = 0f,
    val vibrance: Float = 0f,
    val saturation: Float = 0f,
    val compositeCurve: List<CurvePoint> = identityCurve,
    val redCurve: List<CurvePoint> = identityCurve,
    val greenCurve: List<CurvePoint> = identityCurve,
    val blueCurve: List<CurvePoint> = identityCurve,
    val hsl: Map<String, HslAdjustment> = emptyMap(),
) {
    companion object {
        val identityCurve = listOf(CurvePoint(0f, 0f), CurvePoint(1f, 1f))
        fun neutral(): LumePreset = LumePreset(name = "Neutral")
    }
}

enum class FieldSupport { Supported, Approximated, Unsupported }

data class FieldReport(
    val field: String,
    val support: FieldSupport,
    val sourceValue: String,
    val reason: String? = null,
)

data class XmpImportResult(
    val preset: LumePreset,
    val report: Map<String, FieldReport>,
)
