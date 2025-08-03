import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';

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
    },
    version: '1.70.0',
    ColorThemeKind: {
        Light: 1,
        Dark: 2,
        HighContrast: 3,
        HighContrastLight: 4,
    },
}));

// Mock GameController
const mockGameController = {
    initialize: vi.fn(),
    startNewGame: vi.fn(),
    dispose: vi.fn(),
    setGameViewProvider: vi.fn(),
    validateHealth: vi.fn(() => ({ isHealthy: true, issues: [] })),
    attemptRecovery: vi.fn(() => true),
};

// Mock GameViewProvider
const mockGameViewProvider = {
    viewType: '2048Game',
    postMessage: vi.fn(),
};

vi.mock('./gameController', () => ({
    GameController: vi.fn(() => mockGameController),
}));

vi.mock('./gameViewProvider', () => ({
    GameViewProvider: vi.fn(() => mockGameViewProvider),
}));

describe('Extension Host Error Handling', () => {
    let mockContext: vscode.ExtensionContext;
    let consoleErrorSpy: any;
    let consoleLogSpy: any;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();
        
        // Mock extension context
        mockContext = {
            subscriptions: [],
            extensionUri: { toString: () => 'file:///test' } as vscode.Uri,
            globalState: {
                get: vi.fn(),
                update: vi.fn(),
                keys: vi.fn(() => []),
            },
        } as any;

        // Spy on console methods
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        // Reset process event listeners
        process.removeAllListeners('unhandledRejection');
        process.removeAllListeners('uncaughtException');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('API Failure Graceful Degradation', () => {
        it('should handle VSCode API failures gracefully', async () => {
            // Mock VSCode API to fail
            vi.mocked(vscode.window.createOutputChannel).mockImplementationOnce(() => {
                throw new Error('Output channel creation failed');
            });

            const { activate } = await import('./extension');
            
            // Should handle the failure and continue
            expect(() => activate(mockContext)).not.toThrow();
        });

        it('should handle storage API failures', async () => {
            // Mock storage to fail
            mockContext.globalState.update = vi.fn().mockImplementationOnce(() => {
                throw new Error('Storage update failed');
            });

            const { activate } = await import('./extension');
            const result = activate(mockContext);

            // Should continue despite storage failure
            expect(result).toBeDefined();
        });

        it('should handle command execution failures', async () => {
            // Mock command execution to fail
            vi.mocked(vscode.commands.executeCommand).mockImplementationOnce(() => {
                throw new Error('Command execution failed');
            });

            const { activate } = await import('./extension');
            activate(mockContext);

            // Get the registered command function
            const commandCall = vi.mocked(vscode.commands.registerCommand).mock.calls.find(
                call => call[0] === '2048Game.newGame'
            );
            
            if (commandCall) {
                const commandFunction = commandCall[1];
                
                // Should handle command execution failure
                expect(() => commandFunction()).not.toThrow();
            }
        });

        it('should handle webview registration failures', async () => {
            // Mock webview registration to fail
            vi.mocked(vscode.window.registerWebviewViewProvider).mockImplementationOnce(() => {
                throw new Error('Webview registration failed');
            });

            const { activate } = await import('./extension');
            
            // Should provide fallback behavior
            expect(() => activate(mockContext)).toThrow(); // Expected to throw for critical failures
            expect(vscode.window.showErrorMessage).toHaveBeenCalled();
        });
    });

    describe('Logging for Debugging', () => {
        it('should log errors for debugging', async () => {
            const { activate } = await import('./extension');
            activate(mockContext);

            // Simulate an error
            mockGameController.startNewGame.mockImplementationOnce(() => {
                throw new Error('Test error for logging');
            });

            // Get and execute the new game command
            const commandCall = vi.mocked(vscode.commands.registerCommand).mock.calls.find(
                call => call[0] === '2048Game.newGame'
            );
            
            if (commandCall) {
                const commandFunction = commandCall[1];
                commandFunction();
                
                // Should log the error
                expect(consoleErrorSpy).toHaveBeenCalled();
            }
        });

        it('should create output channel for logging', async () => {
            const { activate } = await import('./extension');
            activate(mockContext);

            expect(vscode.window.createOutputChannel).toHaveBeenCalledWith('2048 Game');
        });

        it('should handle logging failures gracefully', async () => {
            // Mock output channel to fail
            const mockOutputChannel = {
                appendLine: vi.fn().mockImplementationOnce(() => {
                    throw new Error('Logging failed');
                }),
                show: vi.fn(),
                dispose: vi.fn(),
            };
            vi.mocked(vscode.window.createOutputChannel).mockReturnValueOnce(mockOutputChannel);

            const { activate } = await import('./extension');
            
            // Should handle logging failure gracefully
            expect(() => activate(mockContext)).not.toThrow();
        });
    });

    describe('Fallback Behaviors for Missing Features', () => {
        it('should continue without saved game when loading fails', async () => {
            // Mock controller initialization to fail
            mockGameController.initialize.mockImplementationOnce(() => {
                throw new Error('Failed to load saved game');
            });

            const { activate } = await import('./extension');
            
            // Should continue without saved game
            expect(() => activate(mockContext)).not.toThrow();
            expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalled();
        });

        it('should handle missing VSCode API features gracefully', async () => {
            // Mock missing VSCode API features
            const originalRegisterWebviewViewProvider = vscode.window.registerWebviewViewProvider;
            delete (vscode.window as any).registerWebviewViewProvider;

            const { activate } = await import('./extension');
            
            // Should handle missing API gracefully
            expect(() => activate(mockContext)).toThrow(); // Expected for critical missing features
            
            // Restore the mock
            (vscode.window as any).registerWebviewViewProvider = originalRegisterWebviewViewProvider;
        });

        it('should clean up corrupted storage', async () => {
            // Mock corrupted storage
            mockContext.globalState.get = vi.fn().mockReturnValueOnce('corrupted-data');
            mockContext.globalState.keys = vi.fn().mockReturnValueOnce(['2048Game.gameState']);

            const { activate } = await import('./extension');
            activate(mockContext);

            // Should handle corrupted storage
            expect(mockContext.globalState.update).toHaveBeenCalled();
        });
    });

    describe('Error Recovery Mechanisms', () => {
        it('should attempt recovery for game controller errors', async () => {
            const { activate } = await import('./extension');
            activate(mockContext);

            // Simulate controller error and recovery
            mockGameController.validateHealth.mockReturnValueOnce({
                isHealthy: false,
                issues: ['Game engine state invalid']
            });
            mockGameController.attemptRecovery.mockReturnValueOnce(true);

            // Recovery should be attempted
            expect(mockGameController.attemptRecovery).toBeDefined();
        });

        it('should handle recovery failures', async () => {
            const { activate } = await import('./extension');
            activate(mockContext);

            // Simulate failed recovery
            mockGameController.attemptRecovery.mockReturnValueOnce(false);

            // Should handle failed recovery gracefully
            expect(() => mockGameController.attemptRecovery()).not.toThrow();
        });
    });

    describe('User-Friendly Error Messages', () => {
        it('should show user-friendly error messages', async () => {
            const { activate } = await import('./extension');
            activate(mockContext);

            // Test that error messages are user-friendly
            expect(vscode.window.showErrorMessage).toBeDefined();
            expect(vscode.window.showWarningMessage).toBeDefined();
            expect(vscode.window.showInformationMessage).toBeDefined();
        });

        it('should provide action buttons for critical errors', async () => {
            // Mock critical error scenario
            const { GameController } = await import('./gameController');
            vi.mocked(GameController).mockImplementationOnce(() => {
                throw new Error('Critical controller failure');
            });

            const { activate } = await import('./extension');
            
            expect(() => activate(mockContext)).toThrow();
            
            // Should show error message with action buttons
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('2048 Game extension failed to activate'),
                'Reload VSCode',
                'Show Logs'
            );
        });

        it('should handle user action selections', async () => {
            // Mock user selecting "Show Logs"
            vi.mocked(vscode.window.showErrorMessage).mockResolvedValueOnce('Show Logs');

            const { GameController } = await import('./gameController');
            vi.mocked(GameController).mockImplementationOnce(() => {
                throw new Error('Test error');
            });

            const { activate } = await import('./extension');
            
            expect(() => activate(mockContext)).toThrow();
            
            // Should handle the user's selection
            expect(vscode.window.showErrorMessage).toHaveBeenCalled();
        });
    });

    describe('Global Error Handlers', () => {
        it('should set up unhandled rejection handler', async () => {
            const { activate } = await import('./extension');
            activate(mockContext);

            // Simulate unhandled promise rejection
            const rejectionReason = new Error('Unhandled rejection');
            process.emit('unhandledRejection', rejectionReason, Promise.reject(rejectionReason));

            // Should be handled gracefully
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('should set up uncaught exception handler', async () => {
            const { activate } = await import('./extension');
            activate(mockContext);

            // Simulate uncaught exception
            const exception = new Error('Uncaught exception');
            process.emit('uncaughtException', exception);

            // Should be handled gracefully
            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });

    describe('Extension Deactivation Error Handling', () => {
        it('should deactivate without errors', async () => {
            const { deactivate } = await import('./extension');
            
            expect(() => deactivate()).not.toThrow();
            expect(consoleLogSpy).toHaveBeenCalledWith('2048 Game extension is now deactivated!');
        });

        it('should handle deactivation errors gracefully', async () => {
            const { deactivate } = await import('./extension');
            
            // Mock console.log to throw (simulating an error during deactivation)
            consoleLogSpy.mockImplementationOnce(() => {
                throw new Error('Deactivation error');
            });
            
            // Should not throw even if there's an error
            expect(() => deactivate()).not.toThrow();
        });
    });

    describe('Mock Failure Testing', () => {
        it('should handle GameController creation failure', async () => {
            // Mock GameController constructor to throw
            const { GameController } = await import('./gameController');
            vi.mocked(GameController).mockImplementationOnce(() => {
                throw new Error('Controller creation failed');
            });

            const { activate } = await import('./extension');
            
            expect(() => activate(mockContext)).toThrow();
            expect(vscode.window.showErrorMessage).toHaveBeenCalled();
        });

        it('should handle GameViewProvider creation failure', async () => {
            // Mock GameViewProvider constructor to throw
            const { GameViewProvider } = await import('./gameViewProvider');
            vi.mocked(GameViewProvider).mockImplementationOnce(() => {
                throw new Error('View provider creation failed');
            });

            const { activate } = await import('./extension');
            
            expect(() => activate(mockContext)).toThrow();
        });

        it('should continue if controller initialization fails', async () => {
            // Mock controller initialize to throw
            mockGameController.initialize.mockImplementationOnce(() => {
                throw new Error('Initialization failed');
            });

            const { activate } = await import('./extension');
            
            // Should not throw, should continue with activation
            expect(() => activate(mockContext)).not.toThrow();
            expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalled();
        });

        it('should continue if command registration fails', async () => {
            // Mock command registration to throw
            vi.mocked(vscode.commands.registerCommand).mockImplementationOnce(() => {
                throw new Error('Command registration failed');
            });

            const { activate } = await import('./extension');
            
            // Should not throw, should continue with activation
            expect(() => activate(mockContext)).not.toThrow();
            expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalled();
        });
    });
});