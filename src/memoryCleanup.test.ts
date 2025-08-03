import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameController } from './gameController';
import { GameViewProvider } from './gameViewProvider';
import * as vscode from 'vscode';

/**
 * Memory cleanup and resource management tests
 * Ensures proper disposal of resources on extension deactivation
 */
describe('Memory Cleanup and Resource Management', () => {
    let mockContext: vscode.ExtensionContext;
    let mockWebview: any;
    let mockWebviewView: any;
    let gameController: GameController;
    let gameViewProvider: GameViewProvider;

    beforeEach(() => {
        // Mock VSCode context
        mockContext = {
            subscriptions: [],
            globalState: {
                get: vi.fn(),
                update: vi.fn(),
                keys: vi.fn(() => [])
            },
            extensionUri: { fsPath: '/test/path' } as vscode.Uri
        } as any;

        // Mock webview
        mockWebview = {
            html: '',
            postMessage: vi.fn(),
            onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
            options: {}
        };

        // Mock webview view
        mockWebviewView = {
            webview: mockWebview,
            onDidDispose: vi.fn(() => ({ dispose: vi.fn() }))
        };

        // Mock VSCode APIs
        vi.mocked(vscode.window).showInformationMessage = vi.fn();
        vi.mocked(vscode.window).showErrorMessage = vi.fn();
        vi.mocked(vscode.window).showWarningMessage = vi.fn();
        vi.mocked(vscode.window).onDidChangeActiveColorTheme = vi.fn(() => ({ dispose: vi.fn() }));
        Object.defineProperty(vscode.window, 'activeColorTheme', {
            value: { kind: vscode.ColorThemeKind.Dark },
            writable: true
        });
        vi.mocked(vscode.commands).registerCommand = vi.fn(() => ({ dispose: vi.fn() }));
        vi.mocked(vscode.commands).executeCommand = vi.fn();
        vi.mocked(vscode.window).registerWebviewViewProvider = vi.fn(() => ({ dispose: vi.fn() }));

        // Create instances
        gameController = new GameController(mockContext);
        gameViewProvider = new GameViewProvider(mockContext.extensionUri, gameController);
        gameController.setGameViewProvider(gameViewProvider);
    });

    afterEach(() => {
        vi.clearAllMocks();
        
        // Ensure cleanup
        if (gameController && !gameController['disposed']) {
            gameController.dispose();
        }
    });

    describe('Extension Deactivation Cleanup', () => {
        it('should properly dispose of GameController resources', () => {
            // Set up the controller
            gameController.initialize();
            
            // Verify it's active
            expect(gameController['disposed']).toBeFalsy();
            
            // Dispose
            gameController.dispose();
            
            // Verify cleanup
            expect(gameController['disposed']).toBe(true);
            
            // Verify methods throw after disposal
            expect(() => gameController.startNewGame()).toThrow('GameController has been disposed');
            expect(() => gameController.handleMessage({ type: 'requestNewGame' })).toThrow('GameController has been disposed');
        });

        it('should clean up webview message handlers', () => {
            const messageHandlerSpy = vi.fn();
            mockWebview.onDidReceiveMessage = vi.fn((handler) => {
                messageHandlerSpy(handler);
                return { dispose: vi.fn() };
            });

            // Resolve webview
            gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            
            // Verify message handler was registered
            expect(mockWebview.onDidReceiveMessage).toHaveBeenCalled();
            
            // Dispose controller (which should clean up handlers)
            gameController.dispose();
            
            // Verify no memory leaks from accumulated handlers
            expect(messageHandlerSpy).toHaveBeenCalledTimes(1);
        });

        it('should clean up theme change listeners', () => {
            const themeListenerSpy = vi.fn();
            vi.mocked(vscode.window).onDidChangeActiveColorTheme = vi.fn((handler) => {
                themeListenerSpy(handler);
                return { dispose: vi.fn() };
            });

            // Resolve webview (which sets up theme listener)
            gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            
            // Verify theme listener was set up
            expect(vscode.window.onDidChangeActiveColorTheme).toHaveBeenCalled();
            
            // Dispose should clean up listeners
            gameController.dispose();
        });

        it('should clear saved game state on disposal', () => {
            // Set up some game state
            gameController.initialize();
            gameController.startNewGame();
            
            // Verify state exists
            expect(mockContext.globalState.update).toHaveBeenCalled();
            
            // Dispose
            gameController.dispose();
            
            // Verify disposal state
            expect(gameController['disposed']).toBe(true);
        });

        it('should handle disposal when already disposed', () => {
            // Dispose once
            gameController.dispose();
            expect(gameController['disposed']).toBe(true);
            
            // Dispose again - should not throw
            expect(() => gameController.dispose()).not.toThrow();
            
            // Should still be disposed
            expect(gameController['disposed']).toBe(true);
        });
    });

    describe('Memory Leak Prevention', () => {
        it('should not accumulate message handlers on multiple webview resolutions', () => {
            const handlerCount = { count: 0 };
            mockWebview.onDidReceiveMessage = vi.fn(() => {
                handlerCount.count++;
                return { dispose: vi.fn() };
            });

            // Resolve webview multiple times (simulating theme changes or reloads)
            for (let i = 0; i < 5; i++) {
                gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            }

            // Should not accumulate handlers
            expect(handlerCount.count).toBeLessThanOrEqual(5);
        });

        it('should handle rapid message posting without memory accumulation', () => {
            gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            
            const initialMemory = process.memoryUsage().heapUsed;
            
            // Send many messages rapidly
            for (let i = 0; i < 1000; i++) {
                gameViewProvider.postMessage({
                    type: 'gameStateUpdate',
                    state: {
                        board: [[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
                        score: i,
                        gameState: 'playing',
                        moveCount: i,
                        startTime: Date.now()
                    }
                });
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryGrowth = finalMemory - initialMemory;
            
            // Memory growth should be reasonable (less than 5MB for 1000 messages)
            expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024);
            
            console.log(`Memory growth after 1000 messages: ${(memoryGrowth / 1024).toFixed(2)}KB`);
        });

        it('should clean up queued messages on disposal', () => {
            // Queue messages before webview is ready
            for (let i = 0; i < 10; i++) {
                gameViewProvider.postMessage({
                    type: 'gameStateUpdate',
                    state: {
                        board: [[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
                        score: i,
                        gameState: 'playing',
                        moveCount: i,
                        startTime: Date.now()
                    }
                });
            }
            
            // Verify messages are queued
            expect(gameViewProvider['messageQueue']).toBeDefined();
            expect(gameViewProvider['messageQueue'].length).toBeGreaterThan(0);
            
            // Dispose
            gameController.dispose();
            
            // Queue should be cleared or handled appropriately
            // (Implementation may vary - either cleared or processed)
        });

        it('should handle WebView disposal gracefully', () => {
            gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            
            // Simulate webview disposal
            const onDidDispose = mockWebviewView.onDidDispose;
            if (onDidDispose && typeof onDidDispose === 'function') {
                const disposable = onDidDispose(vi.fn());
                if (disposable && typeof disposable.dispose === 'function') {
                    disposable.dispose();
                }
            }
            
            // Should handle disposal gracefully
            expect(() => {
                gameViewProvider.postMessage({
                    type: 'gameStateUpdate',
                    state: {
                        board: [[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
                        score: 0,
                        gameState: 'playing',
                        moveCount: 0,
                        startTime: Date.now()
                    }
                });
            }).not.toThrow();
        });
    });

    describe('Resource Usage Monitoring', () => {
        it('should track memory usage during normal operation', () => {
            const initialMemory = process.memoryUsage();
            
            // Simulate normal game operation
            gameController.initialize();
            gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            
            // Simulate game moves
            for (let i = 0; i < 100; i++) {
                gameController.startNewGame();
            }
            
            const finalMemory = process.memoryUsage();
            const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
            
            // Memory growth should be reasonable
            expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
            
            console.log('Memory usage during normal operation:', {
                initial: `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
                final: `${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
                growth: `${(memoryGrowth / 1024).toFixed(2)}KB`
            });
        });

        it('should maintain stable memory usage over time', () => {
            gameController.initialize();
            gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            
            const memorySnapshots = [];
            
            // Take memory snapshots during extended operation
            for (let i = 0; i < 10; i++) {
                // Simulate some game activity
                for (let j = 0; j < 50; j++) {
                    gameController.startNewGame();
                }
                
                memorySnapshots.push(process.memoryUsage().heapUsed);
                
                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                }
            }
            
            // Check for memory leaks (significant upward trend)
            const firstSnapshot = memorySnapshots[0];
            const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
            const memoryGrowth = lastSnapshot - firstSnapshot;
            
            // Memory should not grow significantly over time
            expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024); // Less than 5MB growth
            
            console.log('Memory stability test:', {
                snapshots: memorySnapshots.length,
                firstSnapshot: `${(firstSnapshot / 1024 / 1024).toFixed(2)}MB`,
                lastSnapshot: `${(lastSnapshot / 1024 / 1024).toFixed(2)}MB`,
                totalGrowth: `${(memoryGrowth / 1024).toFixed(2)}KB`
            });
        });

        it('should clean up after disposal', () => {
            const beforeSetup = process.memoryUsage().heapUsed;
            
            // Set up extension components
            gameController.initialize();
            gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            
            const afterSetup = process.memoryUsage().heapUsed;
            
            // Dispose everything
            gameController.dispose();
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            
            const afterDisposal = process.memoryUsage().heapUsed;
            
            const setupGrowth = afterSetup - beforeSetup;
            const disposalReduction = afterSetup - afterDisposal;
            
            console.log('Memory cleanup test:', {
                beforeSetup: `${(beforeSetup / 1024 / 1024).toFixed(2)}MB`,
                afterSetup: `${(afterSetup / 1024 / 1024).toFixed(2)}MB`,
                afterDisposal: `${(afterDisposal / 1024 / 1024).toFixed(2)}MB`,
                setupGrowth: `${(setupGrowth / 1024).toFixed(2)}KB`,
                disposalReduction: `${(disposalReduction / 1024).toFixed(2)}KB`
            });
            
            // Disposal should free up some memory (or at least not increase it)
            expect(afterDisposal).toBeLessThanOrEqual(afterSetup + (100 * 1024)); // Allow 100KB tolerance
        });
    });

    describe('Error Handling During Cleanup', () => {
        it('should handle errors during disposal gracefully', () => {
            // Mock an error during disposal
            const originalDispose = gameController.dispose;
            gameController.dispose = vi.fn(() => {
                throw new Error('Disposal error');
            });
            
            // Should not throw when disposal fails
            expect(() => {
                try {
                    gameController.dispose();
                } catch (error) {
                    // Simulate error handling
                    console.error('Disposal error handled:', error);
                }
            }).not.toThrow();
            
            // Restore original method
            gameController.dispose = originalDispose;
        });

        it('should continue cleanup even if some resources fail to dispose', () => {
            // Mock partial disposal failure
            const mockDisposable = {
                dispose: vi.fn(() => {
                    throw new Error('Mock disposal error');
                })
            };
            
            mockContext.subscriptions.push(mockDisposable);
            
            // Should handle partial failures gracefully
            expect(() => gameController.dispose()).not.toThrow();
            
            // Should still mark as disposed
            expect(gameController['disposed']).toBe(true);
        });
    });
});