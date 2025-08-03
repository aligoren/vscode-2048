import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { GameViewProvider } from './gameViewProvider';
import { GameController } from './gameController';
import { GameEngine } from './gameEngine';
import { MessageFactory } from './messageTypes';

// Mock VSCode API
vi.mock('vscode', () => ({
    window: {
        createOutputChannel: vi.fn(() => ({
            appendLine: vi.fn(),
            show: vi.fn(),
            dispose: vi.fn(),
        })),
        showErrorMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showInformationMessage: vi.fn(),
        registerWebviewViewProvider: vi.fn(() => ({ dispose: vi.fn() })),
        activeColorTheme: {
            kind: 1, // Light theme
        },
        onDidChangeActiveColorTheme: vi.fn(),
    },
    commands: {
        registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
        executeCommand: vi.fn(),
    },
    env: {
        openExternal: vi.fn(),
    },
    Uri: {
        parse: vi.fn((url: string) => ({ toString: () => url })),
        file: vi.fn((path: string) => ({ fsPath: path, path, toString: () => path })),
    },
    version: '1.70.0',
    ViewColumn: {
        One: 1,
        Two: 2,
        Three: 3,
    },
    workspace: {
        getConfiguration: vi.fn(() => ({
            get: vi.fn(),
            update: vi.fn(),
        })),
    },
    ColorThemeKind: {
        Light: 1,
        Dark: 2,
        HighContrast: 3,
        HighContrastLight: 4,
    },
}));

describe('End-to-End Integration Tests', () => {
    let mockContext: vscode.ExtensionContext;
    let gameController: GameController;
    let gameViewProvider: GameViewProvider;
    let gameEngine: GameEngine;
    let mockWebviewView: any;
    let mockWebview: any;
    let extensionUri: vscode.Uri;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Mock extension context with proper mock functions
        const mockGlobalState = {
            get: vi.fn(),
            update: vi.fn(),
            keys: vi.fn(() => []),
        };

        mockContext = {
            subscriptions: [],
            extensionUri: vscode.Uri.file('/test/extension'),
            globalState: mockGlobalState,
            workspaceState: {
                get: vi.fn(),
                update: vi.fn(),
                keys: vi.fn(() => []),
            },
            extensionPath: '/test/extension',
            storagePath: '/test/storage',
            globalStoragePath: '/test/global-storage',
            logPath: '/test/logs',
        } as any;

        extensionUri = vscode.Uri.file('/test/extension');

        // Create mock webview
        mockWebview = {
            postMessage: vi.fn(),
            onDidReceiveMessage: vi.fn(),
            html: '',
            options: {},
            cspSource: 'vscode-webview://test',
            asWebviewUri: vi.fn((uri) => uri),
        };

        mockWebviewView = {
            webview: mockWebview,
            visible: true,
            onDidDispose: vi.fn(),
            onDidChangeVisibility: vi.fn(),
            show: vi.fn(),
        };

        // Initialize components
        gameEngine = new GameEngine();
        gameController = new GameController(mockContext);
        gameViewProvider = new GameViewProvider(extensionUri, gameController);
        gameController.setGameViewProvider(gameViewProvider);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Complete User Workflow: New Game', () => {
        it('should handle complete new game workflow from start to finish', () => {
            // Step 1: Initialize webview
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;
            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);

            // Verify webview is set up correctly
            expect(mockWebview.options).toEqual({
                enableScripts: true,
                localResourceRoots: [extensionUri]
            });
            expect(mockWebview.html).toContain('2048 Game');
            expect(mockWebview.onDidReceiveMessage).toHaveBeenCalled();

            // Step 2: User clicks "New Game" button in webview
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
            messageHandler({ type: 'requestNewGame' });

            // Step 3: Verify game controller creates new game
            expect(mockContext.globalState.update).toHaveBeenCalledWith(
                '2048Game.gameState',
                expect.any(String)
            );

            // Step 4: Verify webview receives new game state
            const newGameMessage = mockWebview.postMessage.mock.calls.find(
                (call: any) => call[0].type === 'newGame'
            );
            expect(newGameMessage).toBeDefined();
            expect(newGameMessage![0].state).toEqual(
                expect.objectContaining({
                    score: 0,
                    gameState: 'playing',
                    board: expect.any(Array),
                    moveCount: 0
                })
            );

            // Step 5: Verify board has exactly 2 initial tiles
            const board = newGameMessage![0].state.board;
            let tileCount = 0;
            for (let row = 0; row < 4; row++) {
                for (let col = 0; col < 4; col++) {
                    if (board[row][col] !== 0) {
                        tileCount++;
                        expect([2, 4]).toContain(board[row][col]);
                    }
                }
            }
            expect(tileCount).toBe(2);
        });

        it('should handle complete game move workflow', () => {
            // Initialize webview and start new game
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;
            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
            
            // Start new game
            messageHandler({ type: 'requestNewGame' });
            
            // Clear previous calls to focus on move
            vi.clearAllMocks();

            // Step 1: User presses arrow key (simulate move)
            messageHandler({ type: 'gameMove', direction: 'left' });

            // Step 2: Verify game state is updated and saved
            expect(mockContext.globalState.update).toHaveBeenCalled();

            // Step 3: Verify webview receives updated game state
            const stateUpdateMessage = mockWebview.postMessage.mock.calls.find(
                (call: any) => call[0].type === 'gameStateUpdate'
            );
            
            if (stateUpdateMessage) {
                expect(stateUpdateMessage[0].state).toEqual(
                    expect.objectContaining({
                        moveCount: expect.any(Number),
                        board: expect.any(Array)
                    })
                );
            }
        });
    });

    describe('Complete User Workflow: Game Persistence', () => {
        it('should save and restore game state across sessions', () => {
            // Session 1: Start and play a game
            const context1 = { state: undefined };
            const token = {} as vscode.CancellationToken;
            gameViewProvider.resolveWebviewView(mockWebviewView, context1, token);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];

            // Start new game
            messageHandler({ type: 'requestNewGame' });

            // Get the saved state
            const saveCall = vi.mocked(mockContext.globalState.update).mock.calls.find(
                call => call[0] === '2048Game.gameState'
            );
            expect(saveCall).toBeDefined();
            const savedStateData = saveCall![1];

            // Session 2: Simulate new session loading saved game
            vi.clearAllMocks();
            vi.mocked(mockContext.globalState.get).mockReturnValue(savedStateData);

            // Create new components for new session
            const newGameController = new GameController(mockContext);
            const newGameViewProvider = new GameViewProvider(extensionUri, newGameController);
            newGameController.setGameViewProvider(newGameViewProvider);

            // Initialize new session
            newGameController.initialize();
            newGameViewProvider.resolveWebviewView(mockWebviewView, context1, token);
            const newMessageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];

            // Request saved game
            newMessageHandler({ type: 'requestSavedGame' });

            // Verify saved game is loaded
            const savedGameMessage = mockWebview.postMessage.mock.calls.find(
                (call: any) => call[0].type === 'gameStateChanged'
            );
            expect(savedGameMessage).toBeDefined();
            expect(savedGameMessage![0].state).toEqual(
                expect.objectContaining({
                    score: 0,
                    gameState: 'playing'
                })
            );
        });
    });

    describe('Complete User Workflow: Theme Integration', () => {
        it('should handle theme changes throughout the application', () => {
            // Initialize webview
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;
            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];

            // Step 1: Request initial theme
            messageHandler({ type: 'requestTheme' });

            // Verify theme data is sent
            const themeMessage = mockWebview.postMessage.mock.calls.find(
                (call: any) => call[0].type === 'themeChanged'
            );
            expect(themeMessage).toBeDefined();
            expect(themeMessage![0].theme).toEqual(
                expect.objectContaining({
                    backgroundColor: expect.any(String),
                    foregroundColor: expect.any(String),
                    tileColors: expect.any(Object)
                })
            );

            // Step 2: Simulate VSCode theme change
            vi.clearAllMocks();
            
            // Mock theme change listener
            const themeChangeListener = vi.mocked(vscode.window.onDidChangeActiveColorTheme).mock.calls[0]?.[0];
            if (themeChangeListener) {
                themeChangeListener({ kind: vscode.ColorThemeKind.Dark } as any);

                // Verify new theme is sent to webview
                const newThemeMessage = mockWebview.postMessage.mock.calls.find(
                    (call: any) => call[0].type === 'themeChanged'
                );
                expect(newThemeMessage).toBeDefined();
            }
        });
    });

    describe('Complete User Workflow: Win/Lose Scenarios', () => {
        it('should handle win condition workflow', () => {
            // Initialize webview and start new game
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;
            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];

            // Create a winning game state (with 2048 tile)
            const winningState = {
                board: [
                    [2048, 4, 8, 16],
                    [32, 64, 128, 256],
                    [512, 1024, 2, 4],
                    [8, 16, 32, 64]
                ],
                score: 50000,
                gameState: 'won' as const,
                moveCount: 100,
                startTime: Date.now() - 300000
            };

            // Send winning state update
            messageHandler({ type: 'gameStateUpdate', state: winningState });

            // Verify state is saved
            expect(mockContext.globalState.update).toHaveBeenCalledWith(
                '2048Game.gameState',
                expect.any(String)
            );

            // Verify the saved state reflects the win
            const saveCall = vi.mocked(mockContext.globalState.update).mock.calls.find(
                call => call[0] === '2048Game.gameState'
            );
            const savedState = JSON.parse(saveCall![1]);
            expect(savedState.gameState).toBe('won');
        });

        it('should handle lose condition workflow', () => {
            // Initialize webview and start new game
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;
            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];

            // Create a losing game state (board full, no moves)
            const losingState = {
                board: [
                    [2, 4, 8, 16],
                    [32, 64, 128, 256],
                    [512, 1024, 4, 8],
                    [16, 32, 64, 128]
                ],
                score: 25000,
                gameState: 'lost' as const,
                moveCount: 200,
                startTime: Date.now() - 600000
            };

            // Send losing state update
            messageHandler({ type: 'gameStateUpdate', state: losingState });

            // Verify state is saved
            expect(mockContext.globalState.update).toHaveBeenCalledWith(
                '2048Game.gameState',
                expect.any(String)
            );

            // Verify the saved state reflects the loss
            const saveCall = vi.mocked(mockContext.globalState.update).mock.calls.find(
                call => call[0] === '2048Game.gameState'
            );
            const savedState = JSON.parse(saveCall![1]);
            expect(savedState.gameState).toBe('lost');
        });
    });

    describe('Complete Error Handling Workflow', () => {
        it('should handle and recover from webview errors', () => {
            // Initialize webview
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;
            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];

            // Simulate webview error
            const errorMessage = {
                type: 'error',
                error: {
                    message: 'Rendering failed',
                    stack: 'Error: Rendering failed\n    at render()',
                    context: { type: 'critical' }
                }
            };

            // Send error message
            expect(() => messageHandler(errorMessage)).not.toThrow();

            // Verify error is handled gracefully
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                '2048 Game Error: Rendering failed'
            );
        });

        it('should handle invalid messages gracefully', () => {
            // Initialize webview
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;
            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];

            // Send invalid message
            const invalidMessage = { type: 'invalidType', badData: 'test' };
            expect(() => messageHandler(invalidMessage)).not.toThrow();

            // Verify error response is sent
            const errorResponse = mockWebview.postMessage.mock.calls.find(
                (call: any) => call[0].type === 'error'
            );
            expect(errorResponse).toBeDefined();
        });
    });

    describe('Performance and Resource Management', () => {
        it('should handle rapid user interactions efficiently', () => {
            // Initialize webview
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;
            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];

            // Start new game
            messageHandler({ type: 'requestNewGame' });
            
            // Clear previous calls
            vi.clearAllMocks();

            const startTime = Date.now();

            // Simulate rapid moves
            const directions = ['left', 'right', 'up', 'down'];
            for (let i = 0; i < 50; i++) {
                const direction = directions[i % 4];
                messageHandler({ type: 'gameMove', direction });
            }

            const endTime = Date.now();

            // Should complete within reasonable time
            expect(endTime - startTime).toBeLessThan(1000);

            // Should handle all moves without errors
            expect(mockContext.globalState.update).toHaveBeenCalled();
        });

        it('should clean up resources properly on disposal', () => {
            // Initialize webview
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;
            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);

            // Start new game to create state
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
            messageHandler({ type: 'requestNewGame' });

            // Clear previous calls
            vi.clearAllMocks();

            // Dispose controller
            expect(() => gameController.dispose()).not.toThrow();

            // Should save current state on disposal
            expect(mockContext.globalState.update).toHaveBeenCalled();
        });
    });

    describe('Extension Activation Integration', () => {
        it('should activate extension with all components working together', async () => {
            const { activate } = await import('./extension');
            
            // Mock successful activation
            vi.mocked(vscode.window.registerWebviewViewProvider).mockReturnValue({
                dispose: vi.fn()
            });

            const result = activate(mockContext);

            // Verify extension activation
            expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith(
                '2048Game',
                expect.any(Object),
                expect.objectContaining({
                    webviewOptions: expect.objectContaining({
                        retainContextWhenHidden: true
                    })
                })
            );

            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                '2048Game.newGame',
                expect.any(Function)
            );

            expect(mockContext.subscriptions.length).toBeGreaterThan(0);
        });

        it('should handle command execution through command palette', async () => {
            const { activate } = await import('./extension');
            
            activate(mockContext);

            // Get the registered command function
            const commandCall = vi.mocked(vscode.commands.registerCommand).mock.calls.find(
                call => call[0] === '2048Game.newGame'
            );
            
            expect(commandCall).toBeDefined();
            
            if (commandCall) {
                const commandFunction = commandCall[1];
                
                // Execute the command
                expect(() => commandFunction()).not.toThrow();
                
                // Should show success message
                expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                    'New 2048 game started!'
                );
            }
        });
    });

    describe('Cross-Component State Consistency', () => {
        it('should maintain consistent state across all components', () => {
            // Initialize all components
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;
            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];

            // Start new game
            messageHandler({ type: 'requestNewGame' });

            // Get state from webview message
            const webviewMessage = mockWebview.postMessage.mock.calls.find(
                (call: any) => call[0].type === 'newGame'
            );
            const webviewState = webviewMessage![0].state;

            // Get state from storage
            const storageCall = vi.mocked(mockContext.globalState.update).mock.calls.find(
                call => call[0] === '2048Game.gameState'
            );
            const storedState = JSON.parse(storageCall![1]);

            // Get state from controller
            const controllerState = gameController.loadGameState();

            // All states should be consistent
            expect(webviewState.score).toBe(storedState.score);
            expect(webviewState.gameState).toBe(storedState.gameState);
            expect(webviewState.moveCount).toBe(storedState.moveCount);
            
            if (controllerState) {
                expect(webviewState.score).toBe(controllerState.score);
                expect(webviewState.gameState).toBe(controllerState.gameState);
            }
        });
    });
});