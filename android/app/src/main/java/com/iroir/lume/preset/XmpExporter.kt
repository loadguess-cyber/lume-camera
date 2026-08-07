package com.iroir.lume.preset

import java.util.Locale

class XmpExporter {
    fun write(preset: LumePreset): String = buildString {
        appendLine("<?xpacket begin=\"\"?>")
        appendLine("<x:xmpmeta xmlns:x=\"adobe:ns:meta/\">")
        appendLine("<rdf:RDF xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">")
        append("<rdf:Description xmlns:crs=\"http://ns.adobe.com/camera-raw-settings/1.0/\"")
        attribute("PresetName", preset.name)
        attribute("ProcessVersion", "15.4")
        attribute("Exposure2012", decimal(preset.exposure))
        attribute("Contrast2012", decimal(preset.contrast))
        attribute("Highlights2012", decimal(preset.highlights))
        attribute("Shadows2012", decimal(preset.shadows))
        attribute("Whites2012", decimal(preset.whites))
        attribute("Blacks2012", decimal(preset.blacks))
        attribute("IncrementalTemperature", decimal(preset.temperature))
        attribute("IncrementalTint", decimal(preset.tint))
        attribute("Clarity2012", decimal(preset.clarity))
        attribute("Dehaze", decimal(preset.dehaze))
        attribute("Vibrance", decimal(preset.vibrance))
        attribute("Saturation", decimal(preset.saturation))
        preset.hsl.toSortedMap().forEach { (color, adjustment) ->
            attribute("HueAdjustment$color", decimal(adjustment.hue))
            attribute("SaturationAdjustment$color", decimal(adjustment.saturation))
            attribute("LuminanceAdjustment$color", decimal(adjustment.luminance))
        }
        appendLine(">")
        curve("ToneCurvePV2012", preset.compositeCurve)
        curve("ToneCurvePV2012Red", preset.redCurve)
        curve("ToneCurvePV2012Green", preset.greenCurve)
        curve("ToneCurvePV2012Blue", preset.blueCurve)
        appendLine("</rdf:Description></rdf:RDF></x:xmpmeta>")
        appendLine("<?xpacket end=\"w\"?>")
    }

    private fun StringBuilder.attribute(name: String, value: String) {
        append(" crs:").append(name).append("=\"").append(escape(value)).append('"')
    }

    private fun StringBuilder.curve(name: String, points: List<CurvePoint>) {
        append("<crs:").append(name).appendLine("><rdf:Seq>")
        points.forEach { point ->
            append("<rdf:li>").append(decimal(point.input * 255f)).append(", ")
                .append(decimal(point.output * 255f)).appendLine("</rdf:li>")
        }
        append("</rdf:Seq></crs:").append(name).appendLine(">")
    }

    private fun decimal(value: Float): String = String.format(Locale.US, "%.4f", value).trimEnd('0').trimEnd('.').ifEmpty { "0" }
    private fun escape(value: String): String = value.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;").replace(">", "&gt;")
}
