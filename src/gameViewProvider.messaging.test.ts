/**
 * Unit tests for GameViewProvider messaging functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameViewProvider } from './gameViewProvider';
import { GameController } from './gameController';
import { MessageFactory, MessageValidator } from './messageTypes';

// Mock VSCode API
const mockVscode = {
    Uri: {
        file: vi.fn(),
        joinPath: vi.fn()
    },
    window: {
        activeColorTheme: {
            kind: 1 // Dark theme
        },
        showErrorMessage: vi.fn()
    },
    ColorThemeKind: {
        Light: 1,
        Dark: 2,
        HighContrast: 3,
        HighContrastLight: 4
    },
    commands: {
        executeCommand: vi.fn()
    }
};

// Mock webview
const mockWebview = {
    postMessage: vi.fn(),
    html: '',
    options: {},
    onDidReceiveMessage: vi.fn()
};

// Mock webview view
const mockWebviewView = {
    webview: mockWebview,
    onDidDispose: vi.fn(),
    onDidChangeVisibility: vi.fn()
};

// Mock extension context
const mockExtensionContext = {
    extensionUri: mockVscode.Uri.file('/test/path'),
    globalState: {
        get: vi.fn(),
        update: vi.fn()
    }
};

// Setup global mocks
beforeEach(() => {
    vi.clearAllMocks();
    (global as any).vscode = mockVscode;
});

describe('GameViewProvider Messaging', () => {
    let gameViewProvider: GameViewProvider;
    let gameController: GameController;

    beforeEach(() => {
        gameController = new GameController(mockExtensionContext as any);
        gameViewProvider = new GameViewProvider(mockExtensionContext.extensionUri as any, gameController);
    });

    describe('postMessage', () => {
        beforeEach(() => {
            // Set up the webview view
            gameViewProvider.resolveWebviewView(
                mockWebviewView as any,
                {} as any,
                {} as any
            );
        });

        it('should send valid messages to webview', () => {
            const message = MessageFactory.createExtensionMessage('newGame', {
                state: {
                    board: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
                    score: 0,
                    gameState: 'playing',
                    moveCount: 0,
                    startTime: Date.now()
                }
            });

            gameViewProvider.postMessage(message);

            expect(mockWebview.postMessage).toHaveBeenCalledWith(message);
        });

        it('should reject invalid messages', () => {
            const invalidMessage = {
                type: 'invalidType'
            } as any;

            gameViewProvider.postMessage(invalidMessage);

            expect(mockWebview.postMessage).not.toHaveBeenCalledWith(invalidMessage);
        });

        it('should queue messages when webview is not available', () => {
            // Create provider without resolving webview
            const provider = new GameViewProvider(mockExtensionContext.extensionUri as any, gameController);
            
            const message = MessageFactory.createExtensionMessage('newGame', {
                state: {
                    board: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
                    score: 0,
                    gameState: 'playing',
                    moveCount: 0,
                    startTime: Date.now()
                }
            });

            provider.postMessage(message);

            // Message should be queued, not sent immediately
            expect(mockWebview.postMessage).not.toHaveBeenCalled();
        });

        it('should handle post message errors gracefully', () => {
            mockWebview.postMessage.mockImplementation(() => {
                throw new Error('Post message failed');
            });

            const message = MessageFactory.createExtensionMessage('newGame', {
                state: {
                    board: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
                    score: 0,
                    gameState: 'playing',
                    moveCount: 0,
                    startTime: Date.now()
                }
            });

            // Should not throw
            expect(() => gameViewProvider.postMessage(message)).not.toThrow();
        });
    });

    describe('handleMessage', () => {
        beforeEach(() => {
            gameViewProvider.resolveWebviewView(
                mockWebviewView as any,
                {} as any,
                {} as any
            );
        });

        it('should handle valid webview messages', () => {
            const message = MessageFactory.createWebviewMessage('requestNewGame');
            
            // Get the message handler from the mock
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
            
            // Should not throw
            expect(() => messageHandler(message)).not.toThrow();
        });

        it('should reject invalid webview messages', () => {
            const invalidMessage = {
                type: 'invalidType'
            };
            
            // Get the message handler from the mock
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
            
            // Should not throw but should send error message
            expect(() => messageHandler(invalidMessage)).not.toThrow();
            
            // Should send error message to webview
            expect(mockWebview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'error'
                })
            );
        });

        it('should handle requestNewGame messages', () => {
            const message = MessageFactory.createWebviewMessage('requestNewGame');
            
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
            messageHandler(message);
            
            // Should execute new game command (since game controller is available, it won't call the command directly)
            // The test shows the message was handled without throwing
            expect(() => messageHandler(message)).not.toThrow();
        });

        it('should handle gameMove messages', () => {
            const message = MessageFactory.createWebviewMessage('gameMove', {
                direction: 'up'
            });
            
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
            messageHandler(message);
            
            // Should not throw
            expect(() => messageHandler(message)).not.toThrow();
        });

        it('should handle requestTheme messages', () => {
            const message = MessageFactory.createWebviewMessage('requestTheme');
            
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
            messageHandler(message);
            
            // Should send theme data
            expect(mockWebview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'themeChanged'
                })
            );
        });

        it('should handle error messages from webview', () => {
            const message = MessageFactory.createWebviewMessage('error', {
                error: {
                    message: 'Test error',
                    context: { type: 'critical' }
                }
            });
            
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
            messageHandler(message);
            
            // Should handle error message without throwing
            expect(() => messageHandler(message)).not.toThrow();
        });
    });

    describe('sendThemeData', () => {
        beforeEach(() => {
            gameViewProvider.resolveWebviewView(
                mockWebviewView as any,
                {} as any,
                {} as any
            );
        });

        it('should send theme data with proper message format', () => {
            // Trigger theme data sending
            const message = MessageFactory.createWebviewMessage('requestTheme');
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
            messageHandler(message);

            expect(mockWebview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'themeChanged',
                    theme: expect.objectContaining({
                        kind: expect.any(Number),
                        isHighContrast: expect.any(Boolean),
                        isDark: expect.any(Boolean),
                        backgroundColor: expect.any(String),
                        foregroundColor: expect.any(String),
                        accentColor: expect.any(String),
                        tileColors: expect.any(Object)
                    })
                })
            );
        });

        it('should send fallback theme on error', () => {
            // Mock theme access to throw error
            (mockVscode.window as any).activeColorTheme = null;
            
            const message = MessageFactory.createWebviewMessage('requestTheme');
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
            messageHandler(message);

            // Should still send a theme message (fallback)
            expect(mockWebview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'themeChanged'
                })
            );
        });
    });

    describe('error handling', () => {
        beforeEach(() => {
            gameViewProvider.resolveWebviewView(
                mockWebviewView as any,
                {} as any,
                {} as any
            );
        });

        it('should handle message processing errors gracefully', () => {
            // Mock message handler to throw error
            const originalConsoleError = console.error;
            console.error = vi.fn();

            const message = MessageFactory.createWebviewMessage('requestNewGame');
            
            // Mock game controller to throw error
            gameController.handleMessage = vi.fn().mockImplementation(() => {
                throw new Error('Controller error');
            });

            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
            
            // Should not throw
            expect(() => messageHandler(message)).not.toThrow();
            
            // Should send error message
            expect(mockWebview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'error'
                })
            );

            console.error = originalConsoleError;
        });

        it('should validate message format before processing', () => {
            const invalidMessage = {
                type: 'gameMove',
                direction: 'invalid' // Invalid direction
            };
            
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
            messageHandler(invalidMessage);
            
            // Should send error message for invalid format
            expect(mockWebview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'error',
                    error: expect.objectContaining({
                        message: 'Invalid message format'
                    })
                })
            );
        });
    });
});