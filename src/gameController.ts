import * as vscode from 'vscode';
import { GameEngine } from './gameEngine';
import { ExtensionToWebviewMessage, WebviewToExtensionMessage, MessageFactory } from './messageTypes';
import { GameStateSerialization, SerializationResult, DeserializationResult } from './gameStateSerialization';

export interface GameState {
    board: number[][];
    score: number;
    gameState: 'playing' | 'won' | 'lost';
    moveCount: number;
    startTime: number;
}

// GameMessage interface is now replaced by ExtensionToWebviewMessage from messageTypes

export class GameController {
    private static readonly STORAGE_KEY = '2048Game.gameState';
    private _context: vscode.ExtensionContext;
    private _gameViewProvider?: any; // Will be set by the extension
    private gameEngine?: GameEngine;
    private _disposed: boolean = false;

    constructor(context: vscode.ExtensionContext, gameViewProvider?: any) {
        this._context = context;
        this._gameViewProvider = gameViewProvider;
    }

    public setGameViewProvider(provider: any): void {
        this._gameViewProvider = provider;
    }

    public startNewGame(): void {
        if (this._disposed) {
            throw new Error('GameController has been disposed');
        }

        try {
            console.log('Starting new game...');
            
            // Validate prerequisites
            if (!this._context) {
                throw new Error('Extension context not available');
            }

            // Initialize game engine with validation
            try {
                this.gameEngine = new GameEngine();
                this.gameEngine.initializeGame();
                console.log('Game engine initialized successfully');
            } catch (engineError) {
                console.error('Game engine initialization failed:', engineError);
                throw new Error(`Game engine failed to initialize: ${(engineError as Error).message}`);
            }

            const newGameState: GameState = this.gameEngine.getGameState();
            
            // Validate game state
            if (!newGameState || !newGameState.board || newGameState.board.length !== 4) {
                throw new Error('Invalid game state generated');
            }

            // Automatically save the new game state with error handling
            try {
                this.saveGameState(newGameState);
                console.log('New game state saved successfully');
            } catch (saveError) {
                console.warn('Failed to save new game state:', saveError);
                // Continue without saving - game can still be played
            }

            // Notify the webview with retry mechanism
            if (this._gameViewProvider) {
                try {
                    const newGameMessage = MessageFactory.createExtensionMessage('newGame', {
                        state: newGameState
                    });
                    this._gameViewProvider.postMessage(newGameMessage);
                    console.log('New game message sent to webview');
                } catch (messageError) {
                    console.error('Failed to send new game message:', messageError);
                    // Retry once after a short delay
                    setTimeout(() => {
                        try {
                            const retryMessage = MessageFactory.createExtensionMessage('newGame', {
                                state: newGameState
                            });
                            this._gameViewProvider!.postMessage(retryMessage);
                            console.log('New game message retry successful');
                        } catch (retryError) {
                            console.error('New game message retry failed:', retryError);
                            this.handleError('Failed to notify webview of new game', 'WEBVIEW_COMMUNICATION_ERROR');
                        }
                    }, 500);
                }
            } else {
                console.warn('Game view provider not available for new game notification');
            }

            console.log('New 2048 game started successfully');
        } catch (error) {
            console.error('Error starting new game:', error);
            this.handleError('Failed to start new game', 'NEW_GAME_ERROR');
            
            // Try to provide a fallback minimal game state
            try {
                this.provideFallbackGame();
            } catch (fallbackError) {
                console.error('Fallback game creation also failed:', fallbackError);
                this.handleError('Complete game initialization failure', 'CRITICAL_GAME_ERROR');
            }
        }
    }

    public handleGameStateChange(state: GameState): void {
        try {
            // Validate the game state using the serialization utility
            const validationResult = GameStateSerialization.validateGameState(state);
            if (!validationResult.isValid) {
                throw new Error(`Invalid game state received: ${validationResult.errors.join(', ')}`);
            }

            // Update game engine state if it exists
            if (this.gameEngine) {
                this.gameEngine.loadGameState(state);
            }

            // Check for win/lose conditions and update accordingly
            const updatedState = this.updateGameStatus(state);

            // Automatically save the updated state
            this.saveGameState(updatedState);

            console.log('Game state updated:', {
                score: updatedState.score,
                gameState: updatedState.gameState,
                moveCount: updatedState.moveCount
            });
        } catch (error) {
            console.error('Error handling game state change:', error);
            this.handleError('Failed to update game state', 'STATE_UPDATE_ERROR');
        }
    }

    public saveGameState(state: GameState): void {
        try {
            // Use the robust serialization utility
            const serializationResult: SerializationResult = GameStateSerialization.serialize(state);
            
            if (serializationResult.success && serializationResult.data) {
                // Save to VSCode's global state
                this._context.globalState.update(GameController.STORAGE_KEY, serializationResult.data);
                console.log('Game state saved successfully');
            } else {
                console.error('Failed to serialize game state:', serializationResult.error);
                // Continue without persistence - don't break the game
            }
        } catch (error) {
            console.error('Error saving game state:', error);
            // Don't throw here - game can continue without persistence
        }
    }

    public loadGameState(): GameState | null {
        try {
            const serializedState = this._context.globalState.get<string>(GameController.STORAGE_KEY);
            
            if (!serializedState) {
                console.log('No saved game state found');
                return null;
            }

            // Use the robust deserialization utility
            const deserializationResult: DeserializationResult = GameStateSerialization.deserialize(serializedState);
            
            if (deserializationResult.success && deserializationResult.state) {
                console.log('Game state loaded successfully');
                return deserializationResult.state;
            } else {
                console.warn('Failed to deserialize game state:', deserializationResult.error);
                
                // If the deserialization suggests fallback to new game, clean up the corrupted state
                if (deserializationResult.fallbackToNewGame) {
                    console.log('Cleaning up corrupted game state');
                    this.cleanupCorruptedState();
                }
                
                return null;
            }
        } catch (error) {
            console.error('Error loading game state:', error);
            // Clean up potentially corrupted state
            this.cleanupCorruptedState();
            return null;
        }
    }

    public handleMessage(message: any): void {
        if (this._disposed) {
            throw new Error('GameController has been disposed');
        }

        try {
            switch (message.type) {
                case 'requestNewGame':
                    this.startNewGame();
                    break;
                case 'gameMove':
                    if (message.direction) {
                        this.handleGameMove(message.direction);
                    }
                    break;
                case 'gameStateUpdate':
                    if (message.state) {
                        this.handleGameStateChange(message.state);
                    }
                    break;
                case 'requestSavedGame':
                    this.loadAndSendSavedGame();
                    break;
                case 'shareScore':
                    if (message.shareData) {
                        this.handleShareScore(message.shareData);
                    }
                    break;
                default:
                    console.log('Unknown message type in GameController:', message.type);
            }
        } catch (error) {
            console.error('Error handling message:', error);
            this.handleError('Failed to process message', 'MESSAGE_PROCESSING_ERROR');
        }
    }

    private handleGameMove(direction: string): void {
        try {
            if (!this.gameEngine) {
                console.error('Game engine not initialized');
                this.handleError('Game not initialized', 'GAME_NOT_INITIALIZED');
                return;
            }

            // Validate direction
            const validDirections = ['up', 'down', 'left', 'right'];
            if (!validDirections.includes(direction)) {
                console.error('Invalid move direction:', direction);
                return;
            }

            // Check if game is in a playable state
            if (this.gameEngine.gameState !== 'playing') {
                console.log('Game not in playing state, ignoring move');
                return;
            }

            // Attempt the move
            const moveSuccessful = this.gameEngine.move(direction as 'up' | 'down' | 'left' | 'right');
            
            if (moveSuccessful) {
                const updatedState = this.gameEngine.getGameState();
                
                // Automatically save the updated game state
                this.saveGameState(updatedState);
                
                // Send updated state to webview
                if (this._gameViewProvider) {
                    const stateUpdateMessage = MessageFactory.createExtensionMessage('gameStateUpdate', {
                        state: updatedState
                    });
                    this._gameViewProvider.postMessage(stateUpdateMessage);
                }
            }
            // If move was not successful (no tiles moved), we don't need to do anything
        } catch (error) {
            console.error('Error handling game move:', error);
            this.handleError('Failed to process move', 'MOVE_PROCESSING_ERROR');
        }
    }

    private createEmptyBoard(): number[][] {
        return Array(4).fill(null).map(() => Array(4).fill(0));
    }

    private addRandomTile(board: number[][]): void {
        const emptyCells: { row: number; col: number }[] = [];
        
        // Find all empty cells
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                if (board[row][col] === 0) {
                    emptyCells.push({ row, col });
                }
            }
        }

        if (emptyCells.length > 0) {
            const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            const value = Math.random() < 0.9 ? 2 : 4; // 90% chance of 2, 10% chance of 4
            board[randomCell.row][randomCell.col] = value;
        }
    }



    private updateGameStatus(state: GameState): GameState {
        // Check for win condition (2048 tile)
        if (state.gameState === 'playing') {
            for (const row of state.board) {
                if (row.includes(2048)) {
                    return { ...state, gameState: 'won' };
                }
            }

            // Check for lose condition (no empty cells and no possible moves)
            if (this.isBoardFull(state.board) && !this.hasValidMoves(state.board)) {
                return { ...state, gameState: 'lost' };
            }
        }

        return state;
    }

    private isBoardFull(board: number[][]): boolean {
        for (const row of board) {
            if (row.includes(0)) {
                return false;
            }
        }
        return true;
    }

    private hasValidMoves(board: number[][]): boolean {
        // Check for possible horizontal merges
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 3; col++) {
                if (board[row][col] === board[row][col + 1]) {
                    return true;
                }
            }
        }

        // Check for possible vertical merges
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 4; col++) {
                if (board[row][col] === board[row + 1][col]) {
                    return true;
                }
            }
        }

        return false;
    }

    private loadAndSendSavedGame(): void {
        const savedState = this.loadGameState();
        if (savedState && this._gameViewProvider) {
            // Update the game engine with the loaded state
            if (this.gameEngine) {
                this.gameEngine.loadGameState(savedState);
            } else {
                // Create a new game engine and load the state
                this.gameEngine = new GameEngine();
                this.gameEngine.loadGameState(savedState);
            }
            
            const savedGameMessage = MessageFactory.createExtensionMessage('gameStateChanged', {
                state: savedState
            });
            this._gameViewProvider.postMessage(savedGameMessage);
            console.log('Saved game loaded and sent to webview');
        } else {
            console.log('No valid saved game found');
        }
    }

    /**
     * Clean up corrupted or invalid saved states
     */
    private cleanupCorruptedState(): void {
        try {
            this._context.globalState.update(GameController.STORAGE_KEY, undefined);
            console.log('Corrupted game state cleaned up');
        } catch (error) {
            console.error('Error cleaning up corrupted state:', error);
        }
    }

    /**
     * Initialize the game controller and attempt to load a saved game
     */
    public initialize(): void {
        try {
            const savedState = this.loadGameState();
            if (savedState) {
                // Load the saved game
                this.gameEngine = new GameEngine();
                this.gameEngine.loadGameState(savedState);
                console.log('Game controller initialized with saved state');
            } else {
                console.log('Game controller initialized without saved state');
            }
        } catch (error) {
            console.error('Error initializing game controller:', error);
        }
    }

    /**
     * Handle share score request from webview
     */
    private async handleShareScore(shareData: any): Promise<void> {
        try {
            if (!shareData || typeof shareData.score !== 'number') {
                console.error('Invalid share data received:', shareData);
                return;
            }

            const { score, highestTile, moveCount, gameState, imageData } = shareData;
            
            // Show platform selection
            const platform = await vscode.window.showQuickPick([
                { label: '🐦 Twitter/X\'te paylaş', value: 'twitter' },
                { label: '📋 Copy to Clipboard', value: 'clipboard' }
            ], {
                placeHolder: 'Choose how to share your score'
            });

            if (!platform) {
                return; // User cancelled
            }

            await this.shareToplatform(platform.value, {
                score,
                highestTile,
                moveCount,
                gameState,
                imageData
            });

        } catch (error) {
            console.error('Error handling share score:', error);
            vscode.window.showErrorMessage('Failed to share score. Please try again.');
        }
    }

    /**
     * Share score to selected platform
     */
    private async shareToplatform(platform: string, data: any): Promise<void> {
        try {
            const { score, highestTile, gameState } = data;
            
            let shareText = '';
            let shareUrl = '';

            // Generate share text based on platform
            if (platform === 'twitter') {
                if (gameState === 'won') {
                    shareText = `🎉 Victory in 2048! 🎉

🎯 Final Score: ${score}
🏆 Highest Tile: ${highestTile}
🎮 Playing right in VSCode!

Get the extension:
https://marketplace.visualstudio.com/items?itemName=AliGOREN.vscode-2048

#VSCode #2048Game #Coding #GameDev`;
                } else if (gameState === 'lost') {
                    shareText = `🎮 2048 Game Over! 🎮

📊 Final Score: ${score}
🎯 Highest Tile: ${highestTile}
🔥 Taking a coding break in VSCode!

Get the extension:
https://marketplace.visualstudio.com/items?itemName=AliGOREN.vscode-2048

#VSCode #2048Game #Coding #DeveloperLife`;
                } else {
                    shareText = `🎮 Playing 2048 in VSCode! 🎮

📊 Current Score: ${score}
🎯 Highest Tile: ${highestTile}
🚀 Coding break time!

Get the extension:
https://marketplace.visualstudio.com/items?itemName=AliGOREN.vscode-2048

#VSCode #2048Game #Coding`;
                }
            } else {
                // Clipboard
                shareText = `🎮 2048 Game Results 🎮

📊 Score: ${score}
🎯 Highest Tile: ${highestTile}
🎮 Status: ${gameState}

Played in VSCode with the 2048 extension!
Get it here: https://marketplace.visualstudio.com/items?itemName=AliGOREN.vscode-2048`;
            }

            // Handle platform-specific sharing
            if (platform === 'twitter') {
                // Send URL to webview to open Twitter with prefilled text (avoid VSCode crash)
                const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
                
                if (this._gameViewProvider) {
                    this._gameViewProvider.postMessage({
                        type: 'openBrowser',
                        url: shareUrl,
                        platform: 'twitter'
                    });
                }
            } else {
                // Clipboard only
                await vscode.env.clipboard.writeText(shareText);
                vscode.window.showInformationMessage('Score details copied to clipboard! 📋');
            }

            // Show success message
            if (platform !== 'clipboard' && platform !== 'discord') {
                vscode.window.showInformationMessage(`Score shared to ${platform}! 🚀`);
            }

        } catch (error) {
            console.error('Error sharing to platform:', error);
            vscode.window.showErrorMessage(`Failed to share to ${platform}. Please try again.`);
        }
    }

    /**
     * Public method to trigger share from command palette
     */
    public async shareCurrentScore(): Promise<void> {
        try {
            if (!this.gameEngine) {
                vscode.window.showWarningMessage('No active game to share. Start a new game first!');
                return;
            }

            const gameState = this.gameEngine.getGameState();
            await this.handleShareScore({
                score: gameState.score,
                highestTile: this.gameEngine.getHighestTile(),
                moveCount: gameState.moveCount,
                gameState: gameState.gameState,
                imageData: null // Will be enhanced later with screenshot
            });

        } catch (error) {
            console.error('Error sharing current score:', error);
            vscode.window.showErrorMessage('Failed to share score. Please try again.');
        }
    }

    /**
     * Clean up resources when the extension is deactivated
     */
    public dispose(): void {
        if (this._disposed) {
            return; // Already disposed
        }

        try {
            // Save current game state if there's an active game
            if (this.gameEngine) {
                const currentState = this.gameEngine.getGameState();
                this.saveGameState(currentState);
                console.log('Game state saved on extension deactivation');
            }

            // Clear references
            this.gameEngine = undefined;
            this._gameViewProvider = undefined;

            // Mark as disposed
            this._disposed = true;
            console.log('GameController disposed successfully');
        } catch (error) {
            console.error('Error during game controller disposal:', error);
            // Still mark as disposed even if there was an error
            this._disposed = true;
        }
    }

    /**
     * Check if the controller has been disposed
     */
    public get disposed(): boolean {
        return this._disposed;
    }

    /**
     * Get statistics about saved games for debugging/maintenance
     */
    public getStorageInfo(): { hasStoredGame: boolean; storageKey: string } {
        const hasStoredGame = this._context.globalState.get<string>(GameController.STORAGE_KEY) !== undefined;
        return {
            hasStoredGame,
            storageKey: GameController.STORAGE_KEY
        };
    }

    private handleError(message: string, code?: string): void {
        console.error(`GameController Error [${code}]: ${message}`);
        
        try {
            if (this._gameViewProvider) {
                const errorMessage = MessageFactory.createErrorMessage(message, code, true);
                this._gameViewProvider.postMessage(errorMessage);
            }
        } catch (error) {
            console.error('Failed to send error message to webview:', error);
        }
    }

    /**
     * Provide a fallback minimal game state when normal initialization fails
     */
    private provideFallbackGame(): void {
        console.log('Attempting to provide fallback game...');
        
        // Create minimal game state manually
        const fallbackState: GameState = {
            board: [
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0]
            ],
            score: 0,
            gameState: 'playing',
            moveCount: 0,
            startTime: Date.now()
        };
        
        // Add two initial tiles manually
        fallbackState.board[0][0] = 2;
        fallbackState.board[1][1] = 2;
        
        // Try to notify webview
        if (this._gameViewProvider) {
            try {
                const fallbackMessage = MessageFactory.createExtensionMessage('newGame', {
                    state: fallbackState
                });
                this._gameViewProvider.postMessage(fallbackMessage);
                console.log('Fallback game provided successfully');
            } catch (error) {
                console.error('Failed to send fallback game:', error);
                throw error;
            }
        } else {
            throw new Error('No webview provider available for fallback game');
        }
    }

    /**
     * Validate game controller health and attempt recovery if needed
     */
    public validateHealth(): { isHealthy: boolean; issues: string[] } {
        const issues: string[] = [];
        
        try {
            // Check essential components
            if (!this._context) {
                issues.push('Extension context missing');
            }
            
            if (!this._gameViewProvider) {
                issues.push('Game view provider missing');
            }
            
            // Check storage access
            try {
                const testKey = '2048Game.healthCheck';
                this._context.globalState.update(testKey, 'test');
                const testValue = this._context.globalState.get(testKey);
                if (testValue !== 'test') {
                    issues.push('Storage access failed');
                }
                this._context.globalState.update(testKey, undefined);
            } catch (error) {
                issues.push('Storage validation failed');
            }
            
            // Check game engine if available
            if (this.gameEngine) {
                try {
                    const state = this.gameEngine.getGameState();
                    if (!state || !state.board || state.board.length !== 4) {
                        issues.push('Game engine state invalid');
                    }
                } catch (error) {
                    issues.push('Game engine validation failed');
                }
            }
            
            return {
                isHealthy: issues.length === 0,
                issues
            };
        } catch (error) {
            console.error('Health validation failed:', error);
            return {
                isHealthy: false,
                issues: ['Health validation crashed', ...(issues || [])]
            };
        }
    }

    /**
     * Attempt to recover from errors
     */
    public attemptRecovery(): boolean {
        try {
            console.log('Attempting GameController recovery...');
            
            const health = this.validateHealth();
            if (health.isHealthy) {
                console.log('GameController is healthy, no recovery needed');
                return true;
            }
            
            console.log('GameController issues detected:', health.issues);
            
            // Try to reinitialize game engine if it's the issue
            if (health.issues.includes('Game engine state invalid') || !this.gameEngine) {
                try {
                    this.gameEngine = new GameEngine();
                    this.gameEngine.initializeGame();
                    console.log('Game engine recovered');
                } catch (error) {
                    console.error('Game engine recovery failed:', error);
                    return false;
                }
            }
            
            // Validate recovery
            const postRecoveryHealth = this.validateHealth();
            const recovered = postRecoveryHealth.isHealthy || 
                            postRecoveryHealth.issues.length < health.issues.length;
            
            if (recovered) {
                console.log('GameController recovery successful');
            } else {
                console.log('GameController recovery incomplete:', postRecoveryHealth.issues);
            }
            
            return recovered;
        } catch (error) {
            console.error('GameController recovery failed:', error);
            return false;
        }
    }
}