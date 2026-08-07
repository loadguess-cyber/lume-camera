package com.iroir.lume.color

import com.iroir.lume.preset.CurvePoint

object ToneCurve {
    fun apply(value: Float, points: List<CurvePoint>): Float {
        if (points.size < 2) return value
        val x = value.coerceIn(0f, 1f)
        val sorted = points.sortedBy { it.input }
        if (x <= sorted.first().input) return sorted.first().output
        if (x >= sorted.last().input) return sorted.last().output
        val high = sorted.indexOfFirst { it.input >= x }.coerceAtLeast(1)
        val a = sorted[high - 1]
        val b = sorted[high]
        val span = (b.input - a.input).coerceAtLeast(0.00001f)
        return (a.output + (b.output - a.output) * ((x - a.input) / span)).coerceIn(0f, 1f)
    }
}
