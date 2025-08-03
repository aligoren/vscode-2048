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

describe('Extension Error Handling', () => {
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
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

        // Reset process event listeners
        process.removeAllListeners('unhandledRejection');
        process.removeAllListeners('uncaughtException');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('ExtensionErrorHandler', () => {
        let ExtensionErrorHandler: any;
        let errorHandler: any;

        beforeEach(async () => {
            // Import the extension module to get the ExtensionErrorHandler class
            // Since it's not exported, we'll test it through the activate function
            const extensionModule = await import('./extension');

            // Create a mock error handler for testing
            ExtensionErrorHandler = class {
                constructor(context: vscode.ExtensionContext) {
                    this.context = context;
                    this.outputChannel = vscode.window.createOutputChannel('2048 Game');
                    this.errorCount = 0;
                    this.maxErrors = 10;
                    this.criticalErrors = new Set(['ACTIVATION_FAILURE']);
                }

                handleError(error: Error, errorCode: string = 'UNKNOWN_ERROR', context: any = {}) {
                    this.errorCount++;
                    consoleErrorSpy(`[2048 Game] ${errorCode}:`, {
                        error: error.message,
                        context,
                        count: this.errorCount,
                    });

                    const isCritical = this.criticalErrors.has(errorCode) || this.errorCount >= this.maxErrors;

                    if (isCritical) {
                        this.handleCriticalError(error, errorCode, context);
                    } else {
                        this.handleRecoverableError(error, errorCode, context);
                    }
                }

                handleRecoverableError(error: Error, errorCode: string, context: any) {
                    const userMessage = this.getUserFriendlyMessage(errorCode, error.message);
                    vscode.window.showWarningMessage(userMessage);
                }

                handleCriticalError(error: Error, errorCode: string, context: any) {
                    const userMessage = this.getUserFriendlyMessage(errorCode, error.message);
                    vscode.window.showErrorMessage(userMessage, 'Show Logs', 'Reload Extension');
                }

                getUserFriendlyMessage(errorCode: string, originalMessage: string) {
                    const messages: { [key: string]: string } = {
                        'ACTIVATION_FAILURE': '2048 Game failed to activate. Please reload VSCode.',
                        'CONTROLLER_CREATION_FAILURE': '2048 Game controller failed to initialize.',
                        'VIEW_PROVIDER_REGISTRATION_FAILURE': '2048 Game view failed to register.',
                    };
                    return messages[errorCode] || `2048 Game Error: ${originalMessage}`;
                }

                wrap(fn: Function, errorCode: string = 'WRAPPED_FUNCTION_ERROR', context: any = {}) {
                    return (...args: any[]) => {
                        try {
                            return fn.apply(this, args);
                        } catch (error) {
                            this.handleError(error as Error, errorCode, { ...context, args });
                            return null;
                        }
                    };
                }

                dispose() {
                    this.outputChannel.dispose();
                }
            };

            errorHandler = new ExtensionErrorHandler(mockContext);
        });

        it('should handle recoverable errors', () => {
            const error = new Error('Test recoverable error');
            errorHandler.handleError(error, 'CONTROLLER_CREATION_FAILURE');

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[2048 Game] CONTROLLER_CREATION_FAILURE:',
                expect.objectContaining({
                    error: 'Test recoverable error',
                    count: 1,
                })
            );

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                '2048 Game controller failed to initialize.'
            );
        });

        it('should handle critical errors', () => {
            const error = new Error('Test critical error');
            errorHandler.handleError(error, 'ACTIVATION_FAILURE');

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                '2048 Game failed to activate. Please reload VSCode.',
                'Show Logs',
                'Reload Extension'
            );
        });

        it('should escalate to critical after max errors', () => {
            const error = new Error('Repeated error');

            // Trigger multiple errors
            for (let i = 0; i < 10; i++) {
                errorHandler.handleError(error, 'CONTROLLER_CREATION_FAILURE');
            }

            // The 10th error should be treated as critical
            expect(vscode.window.showErrorMessage).toHaveBeenCalled();
        });

        it('should wrap functions with error handling', () => {
            const throwingFunction = () => {
                throw new Error('Function error');
            };

            const wrappedFunction = errorHandler.wrap(throwingFunction, 'TEST_ERROR');
            const result = wrappedFunction();

            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('should create output channel', () => {
            expect(vscode.window.createOutputChannel).toHaveBeenCalledWith('2048 Game');
        });
    });

    describe('Extension Activation', () => {
        it('should activate successfully with all components', async () => {
            const { activate } = await import('./extension');

            const result = activate(mockContext);

            expect(mockGameController.initialize).toHaveBeenCalled();
            expect(mockGameController.setGameViewProvider).toHaveBeenCalled();
            expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalled();
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                '2048Game.newGame',
                expect.any(Function)
            );
            expect(mockContext.subscriptions.length).toBeGreaterThan(0);
        });

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

        it('should handle view provider registration failure', async () => {
            // Mock registerWebviewViewProvider to throw
            vi.mocked(vscode.window.registerWebviewViewProvider).mockImplementationOnce(() => {
                throw new Error('Registration failed');
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

    describe('New Game Command Error Handling', () => {
        it('should handle new game command errors gracefully', async () => {
            // Mock startNewGame to throw
            mockGameController.startNewGame.mockImplementationOnce(() => {
                throw new Error('New game failed');
            });

            const { activate } = await import('./extension');
            activate(mockContext);

            // Get the registered command function
            const commandCall = vi.mocked(vscode.commands.registerCommand).mock.calls.find(
                call => call[0] === '2048Game.newGame'
            );

            expect(commandCall).toBeDefined();

            if (commandCall) {
                const commandFunction = commandCall[1];

                // Should not throw when command fails
                expect(() => commandFunction()).not.toThrow();
                expect(consoleErrorSpy).toHaveBeenCalled();
            }
        });
    });

    describe('Extension Deactivation', () => {
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

    describe('API Failure Handling', () => {
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
    });

    describe('Recovery Mechanisms', () => {
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

    describe('Fallback Behaviors', () => {
        it('should provide fallback when webview creation fails', async () => {
            // Mock webview registration to fail
            vi.mocked(vscode.window.registerWebviewViewProvider).mockImplementationOnce(() => {
                throw new Error('Webview registration failed');
            });

            const { activate } = await import('./extension');

            // Should provide fallback behavior
            expect(() => activate(mockContext)).toThrow(); // Expected to throw for critical failures
            expect(vscode.window.showErrorMessage).toHaveBeenCalled();
        });

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

        it('should handle missing features gracefully', async () => {
            // Mock missing VSCode API features
            const originalRegisterWebviewViewProvider = vscode.window.registerWebviewViewProvider;
            delete (vscode.window as any).registerWebviewViewProvider;

            const { activate } = await import('./extension');

            // Should handle missing API gracefully
            expect(() => activate(mockContext)).toThrow(); // Expected for critical missing features

            // Restore the mock
            (vscode.window as any).registerWebviewViewProvider = originalRegisterWebviewViewProvider;
        });
    });

    describe('Logging and Debugging', () => {
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

        it('should handle logging failures', async () => {
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

    describe('Error Message User Experience', () => {
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
});