package com.drawguess.game

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.viewmodel.compose.viewModel
import com.drawguess.game.state.GameViewModel
import com.drawguess.game.state.Screen
import com.drawguess.game.ui.EndScreen
import com.drawguess.game.ui.GameScreen
import com.drawguess.game.ui.HomeScreen
import com.drawguess.game.ui.WaitingScreen
import com.drawguess.game.ui.theme.DrawGuessTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            DrawGuessTheme {
                val viewModel: GameViewModel = viewModel()
                when (viewModel.uiState.screen) {
                    Screen.Home -> HomeScreen(viewModel.uiState, viewModel)
                    Screen.Waiting -> WaitingScreen(viewModel.uiState, viewModel)
                    Screen.Game -> GameScreen(viewModel.uiState, viewModel)
                    Screen.End -> EndScreen(viewModel.uiState, viewModel)
                }
            }
        }
    }
}
