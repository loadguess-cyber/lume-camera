package com.iroir.lume.preset

class XmpParser {
    fun parse(xml: String): XmpImportResult {
        require(xml.contains("xmpmeta") || xml.contains("rdf:RDF")) { "Invalid XMP document" }
        val values = parseAttributes(xml).toMutableMap()
        val curves = CURVE_FIELDS.associateWith { parseCurve(xml, it) }
        curves.forEach { (key, points) -> if (points != null) values[key] = "${points.size} points" }

        val report = values.mapValues { (field, value) ->
            val support = when (field) {
                in UNSUPPORTED -> FieldSupport.Unsupported
                in APPROXIMATED -> FieldSupport.Approximated
                in SUPPORTED, in CURVE_FIELDS -> FieldSupport.Supported
                else -> FieldSupport.Unsupported
            }
            FieldReport(
                field = field,
                support = support,
                sourceValue = value,
                reason = if (support == FieldSupport.Unsupported) "Adobe-specific or unknown processing is not reproduced" else null,
            )
        }

        val hsl = HSL_COLORS.associateWith { color ->
            HslAdjustment(
                hue = number(values, "HueAdjustment$color"),
                saturation = number(values, "SaturationAdjustment$color"),
                luminance = number(values, "LuminanceAdjustment$color"),
            )
        }.filterValues { it != HslAdjustment() }

        val preset = LumePreset(
            name = values["PresetName"] ?: values["Name"] ?: "Imported XMP",
            exposure = number(values, "Exposure2012", "Exposure"),
            contrast = number(values, "Contrast2012", "Contrast"),
            highlights = number(values, "Highlights2012", "HighlightRecovery"),
            shadows = number(values, "Shadows2012", "FillLight"),
            whites = number(values, "Whites2012"),
            blacks = number(values, "Blacks2012", "Blacks"),
            temperature = number(values, "IncrementalTemperature"),
            tint = number(values, "IncrementalTint"),
            clarity = number(values, "Clarity2012", "Clarity"),
            dehaze = number(values, "Dehaze"),
            vibrance = number(values, "Vibrance"),
            saturation = number(values, "Saturation"),
            compositeCurve = curves["ToneCurvePV2012"] ?: LumePreset.identityCurve,
            redCurve = curves["ToneCurvePV2012Red"] ?: LumePreset.identityCurve,
            greenCurve = curves["ToneCurvePV2012Green"] ?: LumePreset.identityCurve,
            blueCurve = curves["ToneCurvePV2012Blue"] ?: LumePreset.identityCurve,
            hsl = hsl,
        )
        return XmpImportResult(preset, report)
    }

    private fun parseAttributes(xml: String): Map<String, String> = ATTRIBUTE.findAll(xml)
        .associate { match -> match.groupValues[1] to decode(match.groupValues[2]) }

    private fun parseCurve(xml: String, field: String): List<CurvePoint>? {
        val body = Regex("<crs:$field\\b[^>]*>([\\s\\S]*?)</crs:$field>", RegexOption.IGNORE_CASE)
            .find(xml)?.groupValues?.get(1) ?: return null
        val points = LIST_ITEM.findAll(body).mapNotNull { match ->
            val pair = decode(match.groupValues[1]).split(',').map { it.trim().toFloatOrNull() }
            if (pair.size != 2 || pair.any { it == null }) null
            else CurvePoint(pair[0]!! / 255f, pair[1]!! / 255f)
        }.toList()
        return points.takeIf { it.size >= 2 }
    }

    private fun number(values: Map<String, String>, vararg keys: String): Float =
        keys.firstNotNullOfOrNull { values[it]?.toFloatOrNull() } ?: 0f

    private fun decode(value: String): String = value
        .replace("&quot;", "\"")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")

    companion object {
        private val ATTRIBUTE = Regex("crs:([A-Za-z0-9]+)\\s*=\\s*[\"']([^\"']*)[\"']")
        private val LIST_ITEM = Regex("<rdf:li[^>]*>([^<]+)</rdf:li>", RegexOption.IGNORE_CASE)
        private val CURVE_FIELDS = setOf("ToneCurvePV2012", "ToneCurvePV2012Red", "ToneCurvePV2012Green", "ToneCurvePV2012Blue")
        private val HSL_COLORS = listOf("Red", "Orange", "Yellow", "Green", "Aqua", "Blue", "Purple", "Magenta")
        private val SUPPORTED = setOf(
            "PresetName", "Name", "ProcessVersion", "Exposure2012", "Exposure", "Contrast2012", "Contrast",
            "Highlights2012", "HighlightRecovery", "Shadows2012", "FillLight", "Whites2012", "Blacks2012", "Blacks",
            "IncrementalTemperature", "IncrementalTint", "Vibrance", "Saturation",
        ) + HSL_COLORS.flatMap { listOf("HueAdjustment$it", "SaturationAdjustment$it", "LuminanceAdjustment$it") }
        private val APPROXIMATED = setOf("Clarity2012", "Clarity", "Dehaze")
        private val UNSUPPORTED = setOf(
            "CameraProfile", "LookTableName", "MaskGroupBasedCorrections", "LensProfileEnable", "LensProfileName",
        )
    }
}
