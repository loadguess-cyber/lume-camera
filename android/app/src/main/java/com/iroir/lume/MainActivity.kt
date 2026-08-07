package com.iroir.lume

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.iroir.lume.ui.LumeApp
import com.iroir.lume.ui.theme.LumeTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            LumeTheme {
                LumeApp()
            }
        }
    }
}
