import { describe, it, beforeEach, expect, vi } from 'vitest';
import * as vscode from 'vscode';
import { GameViewProvider } from './gameViewProvider';
import { MessageFactory } from './messageTypes';

// Mock VSCode API
vi.mock('vscode', () => ({
    window: {
        showErrorMessage: vi.fn()
    },
    commands: {
        executeCommand: vi.fn()
    },
    Uri: {
        file: vi.fn((path: string) => ({ fsPath: path, path }))
    }
}));

describe('GameViewProvider', () => {
    let provider: GameViewProvider;
    let mockWebviewView: any;
    let mockWebview: any;
    let extensionUri: vscode.Uri;

    beforeEach(() => {
        extensionUri = vscode.Uri.file('/mock/extension/path');
        provider = new GameViewProvider(extensionUri);

        mockWebview = {
            postMessage: vi.fn(),
            onDidReceiveMessage: vi.fn(),
            html: '',
            options: {}
        };

        mockWebviewView = {
            webview: mockWebview
        };
    });

    it('should create provider instance', () => {
        expect(provider).toBeDefined();
        expect(provider).toBeInstanceOf(GameViewProvider);
    });

    it('should resolve webview view successfully', () => {
        const context = { state: undefined };
        const token = {} as vscode.CancellationToken;

        expect(() => {
            provider.resolveWebviewView(mockWebviewView, context, token);
        }).not.toThrow();

        expect(mockWebview.options.enableScripts).toBe(true);
        expect(mockWebview.html).toContain('2048 Game');
        expect(mockWebview.onDidReceiveMessage).toHaveBeenCalled();
    });

    it('should handle webview creation errors gracefully', () => {
        const badWebviewView = null as any;
        const context = { state: undefined };
        const token = {} as vscode.CancellationToken;

        expect(() => {
            provider.resolveWebviewView(badWebviewView, context, token);
        }).not.toThrow();

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Failed to initialize 2048 game view');
    });

    it('should post messages safely', () => {
        const context = { state: undefined };
        const token = {} as vscode.CancellationToken;
        provider.resolveWebviewView(mockWebviewView, context, token);

        const testMessage = MessageFactory.createExtensionMessage('newGame', {
            state: {
                board: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
                score: 0,
                gameState: 'playing' as const,
                moveCount: 0,
                startTime: Date.now()
            }
        });
        
        expect(() => {
            provider.postMessage(testMessage);
        }).not.toThrow();

        expect(mockWebview.postMessage).toHaveBeenCalledWith(testMessage);
    });

    it('should handle post message errors gracefully', () => {
        // Don't resolve webview view, so _view is undefined
        const testMessage = MessageFactory.createExtensionMessage('error', {
            error: { message: 'Test error', recoverable: true }
        });
        
        expect(() => {
            provider.postMessage(testMessage);
        }).not.toThrow();
    });

    it('should handle requestNewGame message', () => {
        const context = { state: undefined };
        const token = {} as vscode.CancellationToken;
        provider.resolveWebviewView(mockWebviewView, context, token);

        // Get the message handler that was registered
        const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
        
        expect(() => {
            messageHandler({ type: 'requestNewGame' });
        }).not.toThrow();

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('2048Game.newGame');
    });

    it('should handle gameStateUpdate message', () => {
        const context = { state: undefined };
        const token = {} as vscode.CancellationToken;
        provider.resolveWebviewView(mockWebviewView, context, token);

        const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
        const gameState = { board: [[0]], score: 100 };
        
        expect(() => {
            messageHandler({ type: 'gameStateUpdate', state: gameState });
        }).not.toThrow();
    });

    it('should handle requestTheme message', () => {
        const context = { state: undefined };
        const token = {} as vscode.CancellationToken;
        provider.resolveWebviewView(mockWebviewView, context, token);

        const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
        
        expect(() => {
            messageHandler({ type: 'requestTheme' });
        }).not.toThrow();

        // Should post theme data back
        expect(mockWebview.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'themeChanged',
                theme: expect.any(Object)
            })
        );
    });

    it('should handle unknown message types gracefully', () => {
        const context = { state: undefined };
        const token = {} as vscode.CancellationToken;
        provider.resolveWebviewView(mockWebviewView, context, token);

        const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
        
        expect(() => {
            messageHandler({ type: 'unknownType', data: 'test' });
        }).not.toThrow();
    });

    it('should handle message processing errors', () => {
        const context = { state: undefined };
        const token = {} as vscode.CancellationToken;
        provider.resolveWebviewView(mockWebviewView, context, token);

        const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
        
        // Mock executeCommand to throw an error
        vi.mocked(vscode.commands.executeCommand).mockImplementation(() => {
            throw new Error('Command failed');
        });
        
        expect(() => {
            messageHandler({ type: 'requestNewGame' });
        }).not.toThrow();

        // Should post error message
        expect(mockWebview.postMessage).toHaveBeenCalledWith({
            type: 'error',
            message: 'Failed to process message'
        });
    });

    it('should generate HTML with proper structure', () => {
        const context = { state: undefined };
        const token = {} as vscode.CancellationToken;
        provider.resolveWebviewView(mockWebviewView, context, token);

        const html = mockWebview.html;
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('2048 Game');
        expect(html).toContain('game-container');
        expect(html).toContain('game-board');
        expect(html).toContain('New Game');
        expect(html).toContain('acquireVsCodeApi()');
    });

    it('should generate error HTML when needed', () => {
        // Force an error during webview resolution by providing a webview that throws on HTML assignment
        const badWebviewView = {
            webview: {
                set html(value: string) {
                    throw new Error('HTML setting failed');
                },
                get html() { return ''; },
                options: {},
                onDidReceiveMessage: vi.fn()
            }
        };

        const context = { state: undefined };
        const token = {} as vscode.CancellationToken;

        // The method should handle the error gracefully and not re-throw
        provider.resolveWebviewView(badWebviewView as any, context, token);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Failed to initialize 2048 game view');
    });
});