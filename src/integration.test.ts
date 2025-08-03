import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { GameViewProvider } from './gameViewProvider';
import { GameController } from './gameController';
import { MessageFactory } from './messageTypes';

// Mock VSCode API with comprehensive mocking
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

describe('VSCode Extension Integration Tests', () => {
    let mockContext: vscode.ExtensionContext;
    let gameController: GameController;
    let gameViewProvider: GameViewProvider;
    let mockWebviewView: any;
    let mockWebview: any;
    let extensionUri: vscode.Uri;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Mock extension context
        mockContext = {
            subscriptions: [],
            extensionUri: vscode.Uri.file('/test/extension'),
            globalState: {
                get: vi.fn(),
                update: vi.fn(),
                keys: vi.fn(() => []),
            },
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
        gameController = new GameController(mockContext);
        gameViewProvider = new GameViewProvider(extensionUri);
        gameController.setGameViewProvider(gameViewProvider);
    });

    afterEach(() => {
        vi.restoreAllMocks();
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

        it('should handle view registration with proper options', async () => {
            const { activate } = await import('./extension');
            
            activate(mockContext);

            const registerCall = vi.mocked(vscode.window.registerWebviewViewProvider).mock.calls[0];
            expect(registerCall[0]).toBe('2048Game');
            expect(registerCall[1]).toBeInstanceOf(GameViewProvider);
            expect(registerCall[2]).toEqual({
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            });
        });

        it('should register commands with proper handlers', async () => {
            const { activate } = await import('./extension');
            
            activate(mockContext);

            const commandCall = vi.mocked(vscode.commands.registerCommand).mock.calls.find(
                call => call[0] === '2048Game.newGame'
            );
            
            expect(commandCall).toBeDefined();
            expect(typeof commandCall![1]).toBe('function');
        });
    });

    describe('Webview Creation and Message Passing Integration', () => {
        it('should create webview with proper HTML content', () => {
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;

            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);

            expect(mockWebview.options).toEqual({
                enableScripts: true,
                localResourceRoots: [extensionUri]
            });

            expect(mockWebview.html).toContain('<!DOCTYPE html>');
            expect(mockWebview.html).toContain('2048 Game');
            expect(mockWebview.html).toContain('game-container');
            expect(mockWebview.html).toContain('acquireVsCodeApi()');
        });

        it('should establish bidirectional message communication', () => {
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;

            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);

            // Verify message listener is set up
            expect(mockWebview.onDidReceiveMessage).toHaveBeenCalled();

            // Test sending message from extension to webview
            const testMessage = MessageFactory.createExtensionMessage('newGame', {
                state: {
                    board: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
                    score: 0,
                    gameState: 'playing' as const,
                    moveCount: 0,
                    startTime: Date.now()
                }
            });

            gameViewProvider.postMessage(testMessage);
            expect(mockWebview.postMessage).toHaveBeenCalledWith(testMessage);

            // Test receiving message from webview
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
            messageHandler({ type: 'requestNewGame' });

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('2048Game.newGame');
        });

        it('should handle webview to extension message flow', () => {
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;

            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];

            // Test different message types
            const testMessages = [
                { type: 'requestNewGame' },
                { type: 'gameStateUpdate', state: { score: 100 } },
                { type: 'requestTheme' },
            ];

            testMessages.forEach(message => {
                expect(() => messageHandler(message)).not.toThrow();
            });

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('2048Game.newGame');
            expect(mockWebview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'themeChanged' })
            );
        });
    });

    describe('Game Controller and View Provider Integration', () => {
        it('should coordinate new game creation between controller and view', () => {
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;

            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);
            
            // Start new game through controller
            gameController.startNewGame();

            // Verify controller saves state
            expect(mockContext.globalState.update).toHaveBeenCalledWith(
                '2048Game.gameState',
                expect.any(String)
            );

            // Verify view provider receives message
            expect(mockWebview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'newGame',
                    state: expect.objectContaining({
                        score: 0,
                        gameState: 'playing',
                        board: expect.any(Array)
                    })
                })
            );
        });

        it('should handle game state updates from webview to controller', () => {
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;

            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];

            const gameState = {
                board: [[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
                score: 100,
                gameState: 'playing' as const,
                moveCount: 5,
                startTime: Date.now()
            };

            // Simulate webview sending game state update
            messageHandler({ type: 'gameStateUpdate', state: gameState });

            // Verify controller processes the update
            expect(mockContext.globalState.update).toHaveBeenCalledWith(
                '2048Game.gameState',
                expect.any(String)
            );
        });

        it('should load and restore saved game state', () => {
            const savedGameState = {
                board: [[2, 4, 8, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
                score: 150,
                gameState: 'playing' as const,
                moveCount: 10,
                startTime: Date.now() - 60000
            };

            // Mock saved state in storage
            const serializedState = JSON.stringify(savedGameState);
            mockContext.globalState.get.mockReturnValue(serializedState);

            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;

            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];

            // Request saved game
            messageHandler({ type: 'requestSavedGame' });

            // Verify saved state is loaded and sent to webview
            expect(mockWebview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'gameStateChanged',
                    state: expect.objectContaining({
                        score: 150,
                        moveCount: 10
                    })
                })
            );
        });
    });

    describe('Theme Integration', () => {
        it('should provide theme data to webview', () => {
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;

            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];

            // Request theme
            messageHandler({ type: 'requestTheme' });

            expect(mockWebview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'themeChanged',
                    theme: expect.objectContaining({
                        backgroundColor: expect.any(String),
                        foregroundColor: expect.any(String),
                        tileColors: expect.any(Object)
                    })
                })
            );
        });

        it('should handle theme changes dynamically', () => {
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;

            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);

            // Simulate theme change
            const newTheme = {
                backgroundColor: '#000000',
                foregroundColor: '#ffffff',
                tileColors: { 2: '#ff0000', 4: '#00ff00' }
            };

            gameViewProvider.postMessage(
                MessageFactory.createExtensionMessage('themeChanged', { theme: newTheme })
            );

            expect(mockWebview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'themeChanged',
                    theme: newTheme
                })
            );
        });
    });

    describe('Error Handling Integration', () => {
        it('should handle webview creation errors gracefully', () => {
            const badWebviewView = null as any;
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;

            expect(() => {
                gameViewProvider.resolveWebviewView(badWebviewView, context, token);
            }).not.toThrow();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Failed to initialize 2048 game view'
            );
        });

        it('should handle message processing errors', () => {
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;

            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];

            // Mock command execution to fail
            vi.mocked(vscode.commands.executeCommand).mockImplementation(() => {
                throw new Error('Command failed');
            });

            expect(() => {
                messageHandler({ type: 'requestNewGame' });
            }).not.toThrow();

            expect(mockWebview.postMessage).toHaveBeenCalledWith({
                type: 'error',
                message: 'Failed to process message'
            });
        });

        it('should handle storage errors during game state operations', () => {
            mockContext.globalState.update.mockImplementation(() => {
                throw new Error('Storage error');
            });

            expect(() => {
                gameController.startNewGame();
            }).not.toThrow();

            // Should still attempt to notify webview despite storage error
            expect(mockWebview.postMessage).toHaveBeenCalled();
        });
    });

    describe('Command Integration', () => {
        it('should execute new game command through command palette', async () => {
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
            }
        });

        it('should handle command execution errors', async () => {
            const { activate } = await import('./extension');
            
            activate(mockContext);

            // Get the registered command function
            const commandCall = vi.mocked(vscode.commands.registerCommand).mock.calls.find(
                call => call[0] === '2048Game.newGame'
            );
            
            if (commandCall) {
                const commandFunction = commandCall[1];
                
                // Mock the controller to throw an error
                const originalStartNewGame = gameController.startNewGame;
                gameController.startNewGame = vi.fn(() => {
                    throw new Error('Game start failed');
                });
                
                // Should handle error gracefully
                expect(() => commandFunction()).not.toThrow();
                
                // Restore original method
                gameController.startNewGame = originalStartNewGame;
            }
        });
    });

    describe('Lifecycle Integration', () => {
        it('should handle extension deactivation properly', async () => {
            const { activate, deactivate } = await import('./extension');
            
            // Activate first
            activate(mockContext);
            
            // Then deactivate
            expect(() => deactivate()).not.toThrow();
        });

        it('should clean up resources on disposal', () => {
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;

            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);
            
            // Simulate disposal
            expect(() => {
                gameController.dispose();
            }).not.toThrow();

            // Should save current state before disposal
            expect(mockContext.globalState.update).toHaveBeenCalled();
        });

        it('should handle webview disposal', () => {
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;

            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);
            
            // Simulate webview disposal
            const disposeHandler = mockWebviewView.onDidDispose.mock.calls[0]?.[0];
            if (disposeHandler) {
                expect(() => disposeHandler()).not.toThrow();
            }
        });
    });

    describe('State Persistence Integration', () => {
        it('should persist game state across sessions', () => {
            // Start a game
            gameController.startNewGame();
            
            const firstSaveCall = mockContext.globalState.update.mock.calls[0];
            expect(firstSaveCall[0]).toBe('2048Game.gameState');
            expect(firstSaveCall[1]).toBeDefined();

            // Simulate loading in new session
            const savedData = firstSaveCall[1];
            mockContext.globalState.get.mockReturnValue(savedData);

            const loadedState = gameController.loadGameState();
            expect(loadedState).toBeDefined();
            expect(loadedState?.score).toBe(0);
            expect(loadedState?.gameState).toBe('playing');
        });

        it('should handle corrupted state data', () => {
            // Mock corrupted data
            mockContext.globalState.get.mockReturnValue('invalid-json-data');

            const loadedState = gameController.loadGameState();
            expect(loadedState).toBeNull();

            // Should clean up corrupted data
            expect(mockContext.globalState.update).toHaveBeenCalledWith(
                '2048Game.gameState',
                undefined
            );
        });

        it('should validate loaded state integrity', () => {
            const invalidState = {
                board: 'not-an-array',
                score: 'not-a-number',
                gameState: 'invalid-state'
            };

            mockContext.globalState.get.mockReturnValue(JSON.stringify(invalidState));

            const loadedState = gameController.loadGameState();
            expect(loadedState).toBeNull();
        });
    });

    describe('Performance Integration', () => {
        it('should handle rapid message exchanges efficiently', () => {
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;

            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];

            const startTime = Date.now();

            // Send many messages rapidly
            for (let i = 0; i < 100; i++) {
                messageHandler({ type: 'requestTheme' });
            }

            const endTime = Date.now();
            
            // Should complete within reasonable time
            expect(endTime - startTime).toBeLessThan(1000);
            expect(mockWebview.postMessage).toHaveBeenCalledTimes(100);
        });

        it('should handle large game states efficiently', () => {
            const largeGameState = {
                board: Array(4).fill(null).map(() => Array(4).fill(2048)),
                score: 999999,
                gameState: 'playing' as const,
                moveCount: 10000,
                startTime: Date.now(),
                // Add extra data to make it large
                history: Array(1000).fill({ move: 'up', score: 100 })
            };

            const startTime = Date.now();
            
            expect(() => {
                gameController.handleGameStateChange(largeGameState as any);
            }).not.toThrow();

            const endTime = Date.now();
            
            // Should handle large state within reasonable time
            expect(endTime - startTime).toBeLessThan(100);
        });
    });

    describe('Cross-Component Communication', () => {
        it('should maintain consistent state across all components', () => {
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;

            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);
            
            // Start new game through controller
            gameController.startNewGame();

            // Verify state consistency
            const controllerMessage = mockWebview.postMessage.mock.calls.find(
                call => call[0].type === 'newGame'
            );
            
            expect(controllerMessage).toBeDefined();
            expect(controllerMessage![0].state.score).toBe(0);
            expect(controllerMessage![0].state.gameState).toBe('playing');
            
            // Verify storage consistency
            const storageCall = mockContext.globalState.update.mock.calls.find(
                call => call[0] === '2048Game.gameState'
            );
            
            expect(storageCall).toBeDefined();
            
            const storedState = JSON.parse(storageCall![1]);
            expect(storedState.score).toBe(0);
            expect(storedState.gameState).toBe('playing');
        });

        it('should handle concurrent operations safely', () => {
            const context = { state: undefined };
            const token = {} as vscode.CancellationToken;

            gameViewProvider.resolveWebviewView(mockWebviewView, context, token);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];

            // Simulate concurrent operations
            const operations = [
                () => gameController.startNewGame(),
                () => messageHandler({ type: 'requestNewGame' }),
                () => messageHandler({ type: 'requestTheme' }),
                () => gameController.dispose(),
            ];

            // All operations should complete without throwing
            operations.forEach(op => {
                expect(() => op()).not.toThrow();
            });
        });
    });
});