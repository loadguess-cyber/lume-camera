package com.iroir.lume.color

import com.iroir.lume.preset.LumePreset
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

data class LinearRgb(val r: Float, val g: Float, val b: Float) {
    fun map(transform: (Float) -> Float): LinearRgb = LinearRgb(transform(r), transform(g), transform(b))
    fun clamp(): LinearRgb = map { it.coerceIn(0f, 1f) }
}

class ColorPipeline {
    fun renderPixel(input: LinearRgb, preset: LumePreset): LinearRgb {
        var color = applyWhiteBalance(input, preset.temperature, preset.tint)
        color = color.map { it * 2f.pow(preset.exposure) }
        color = applyBasicTone(color, preset)
        color = color.map { ToneCurve.apply(it, preset.compositeCurve) }
        color = LinearRgb(
            ToneCurve.apply(color.r, preset.redCurve),
            ToneCurve.apply(color.g, preset.greenCurve),
            ToneCurve.apply(color.b, preset.blueCurve),
        )
        color = applySaturation(color, preset.saturation, preset.vibrance)
        return color.clamp()
    }

    private fun applyWhiteBalance(color: LinearRgb, temperature: Float, tint: Float): LinearRgb {
        val warm = temperature / 100f
        val magenta = tint / 100f
        return LinearRgb(
            color.r * (1f + warm * .10f + magenta * .035f),
            color.g * (1f - magenta * .05f),
            color.b * (1f - warm * .10f + magenta * .025f),
        )
    }

    private fun applyBasicTone(color: LinearRgb, preset: LumePreset): LinearRgb = color.map { channel ->
        var value = channel
        val contrastScale = 1f + preset.contrast / 100f
        value = .18f + (value - .18f) * contrastScale
        val shadowWeight = (1f - value.coerceIn(0f, 1f)).pow(2)
        val highlightWeight = value.coerceIn(0f, 1f).pow(2)
        value += shadowWeight * preset.shadows / 100f * .25f
        value += highlightWeight * preset.highlights / 100f * .25f
        value += preset.blacks / 100f * .08f * (1f - value.coerceIn(0f, 1f))
        value += preset.whites / 100f * .08f * value.coerceIn(0f, 1f)
        value
    }

    private fun applySaturation(color: LinearRgb, saturation: Float, vibrance: Float): LinearRgb {
        val luma = color.r * .2126f + color.g * .7152f + color.b * .0722f
        val maxChannel = max(color.r, max(color.g, color.b))
        val minChannel = min(color.r, min(color.g, color.b))
        val currentChroma = (maxChannel - minChannel).coerceIn(0f, 1f)
        val scale = 1f + saturation / 100f + vibrance / 100f * (1f - currentChroma) * .65f
        return LinearRgb(
            luma + (color.r - luma) * scale,
            luma + (color.g - luma) * scale,
            luma + (color.b - luma) * scale,
        )
    }
}
