import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameController } from './gameController';
import { GameViewProvider } from './gameViewProvider';
import { GameEngine } from './gameEngine';
import * as vscode from 'vscode';

/**
 * Startup performance tests to ensure minimal impact on VSCode startup time
 * Tests extension activation speed and resource loading efficiency
 */
describe('Startup Performance Tests', () => {
    let mockContext: vscode.ExtensionContext;
    let mockWebview: any;
    let mockWebviewView: any;

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
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Extension Activation Performance', () => {
        it('should activate extension components quickly', () => {
            const startTime = performance.now();
            
            // Simulate extension activation
            const gameController = new GameController(mockContext);
            const gameViewProvider = new GameViewProvider(mockContext.extensionUri, gameController);
            gameController.setGameViewProvider(gameViewProvider);
            
            const endTime = performance.now();
            const activationTime = endTime - startTime;
            
            // Extension activation should be very fast (less than 5ms)
            expect(activationTime).toBeLessThan(5);
            
            console.log(`Extension activation time: ${activationTime.toFixed(2)}ms`);
            
            // Cleanup
            gameController.dispose();
        });

        it('should create core classes with minimal overhead', () => {
            const measurements = {
                gameEngine: 0,
                gameController: 0,
                gameViewProvider: 0
            };

            // Measure GameEngine creation
            let startTime = performance.now();
            const gameEngine = new GameEngine();
            measurements.gameEngine = performance.now() - startTime;

            // Measure GameController creation
            startTime = performance.now();
            const gameController = new GameController(mockContext);
            measurements.gameController = performance.now() - startTime;

            // Measure GameViewProvider creation
            startTime = performance.now();
            const gameViewProvider = new GameViewProvider(mockContext.extensionUri, gameController);
            measurements.gameViewProvider = performance.now() - startTime;

            // All components should create quickly
            expect(measurements.gameEngine).toBeLessThan(1);
            expect(measurements.gameController).toBeLessThan(2);
            expect(measurements.gameViewProvider).toBeLessThan(1);

            console.log('Component creation times:', {
                gameEngine: `${measurements.gameEngine.toFixed(3)}ms`,
                gameController: `${measurements.gameController.toFixed(3)}ms`,
                gameViewProvider: `${measurements.gameViewProvider.toFixed(3)}ms`
            });

            // Cleanup
            gameController.dispose();
        });

        it('should defer heavy operations until needed', () => {
            const startTime = performance.now();
            
            // Create provider but don't resolve webview yet
            const gameController = new GameController(mockContext);
            const gameViewProvider = new GameViewProvider(mockContext.extensionUri, gameController);
            
            const creationTime = performance.now() - startTime;
            
            // Provider creation should be instant
            expect(creationTime).toBeLessThan(1);
            
            // HTML should not be generated yet
            expect(mockWebview.html).toBe('');
            
            // Now resolve webview (heavier operation)
            const resolveStartTime = performance.now();
            gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            const resolveTime = performance.now() - resolveStartTime;
            
            // Webview resolution can be slower but should still be reasonable
            expect(resolveTime).toBeLessThan(20);
            
            // HTML should now be generated
            expect(mockWebview.html).toContain('2048 Game');
            
            console.log('Lazy loading performance:', {
                creation: `${creationTime.toFixed(3)}ms`,
                resolution: `${resolveTime.toFixed(2)}ms`
            });

            // Cleanup
            gameController.dispose();
        });

        it('should minimize synchronous operations during activation', () => {
            const syncOperations = [];
            
            // Mock synchronous operations that could block startup
            const originalConsoleLog = console.log;
            console.log = vi.fn((...args) => {
                if (args[0] && typeof args[0] === 'string' && args[0].includes('sync')) {
                    syncOperations.push(args[0]);
                }
                originalConsoleLog(...args);
            });

            const startTime = performance.now();
            
            // Create components
            const gameController = new GameController(mockContext);
            const gameViewProvider = new GameViewProvider(mockContext.extensionUri, gameController);
            gameController.setGameViewProvider(gameViewProvider);
            
            const endTime = performance.now();
            
            // Restore console.log
            console.log = originalConsoleLog;
            
            // Should complete quickly with minimal sync operations
            expect(endTime - startTime).toBeLessThan(5);
            expect(syncOperations.length).toBeLessThan(3);
            
            console.log(`Activation with ${syncOperations.length} sync operations: ${(endTime - startTime).toFixed(2)}ms`);

            // Cleanup
            gameController.dispose();
        });
    });

    describe('Resource Loading Efficiency', () => {
        it('should load saved game state efficiently', () => {
            // Mock saved game state
            const mockSavedState = {
                board: [[2, 4, 0, 0], [0, 0, 8, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
                score: 12,
                gameState: 'playing' as const,
                moveCount: 3,
                startTime: Date.now() - 60000
            };
            
            mockContext.globalState.get = vi.fn().mockReturnValue(JSON.stringify(mockSavedState));
            
            const startTime = performance.now();
            
            const gameController = new GameController(mockContext);
            gameController.initialize();
            
            const endTime = performance.now();
            const loadTime = endTime - startTime;
            
            // State loading should be fast
            expect(loadTime).toBeLessThan(5);
            
            console.log(`Saved state loading time: ${loadTime.toFixed(2)}ms`);

            // Cleanup
            gameController.dispose();
        });

        it('should handle missing saved state gracefully', () => {
            // Mock no saved state
            mockContext.globalState.get = vi.fn().mockReturnValue(undefined);
            
            const startTime = performance.now();
            
            const gameController = new GameController(mockContext);
            gameController.initialize();
            
            const endTime = performance.now();
            const initTime = endTime - startTime;
            
            // Initialization should be fast even without saved state
            expect(initTime).toBeLessThan(3);
            
            console.log(`Fresh initialization time: ${initTime.toFixed(2)}ms`);

            // Cleanup
            gameController.dispose();
        });

        it('should handle corrupted saved state efficiently', () => {
            // Mock corrupted saved state
            mockContext.globalState.get = vi.fn().mockReturnValue('invalid json{');
            
            const startTime = performance.now();
            
            const gameController = new GameController(mockContext);
            gameController.initialize();
            
            const endTime = performance.now();
            const recoveryTime = endTime - startTime;
            
            // Recovery should be fast
            expect(recoveryTime).toBeLessThan(5);
            
            console.log(`Corrupted state recovery time: ${recoveryTime.toFixed(2)}ms`);

            // Cleanup
            gameController.dispose();
        });

        it('should minimize initial memory footprint', () => {
            const initialMemory = process.memoryUsage().heapUsed;
            
            // Create extension components
            const gameController = new GameController(mockContext);
            const gameViewProvider = new GameViewProvider(mockContext.extensionUri, gameController);
            gameController.setGameViewProvider(gameViewProvider);
            
            const afterCreation = process.memoryUsage().heapUsed;
            const memoryUsed = afterCreation - initialMemory;
            
            // Initial memory usage should be minimal (less than 1MB)
            expect(memoryUsed).toBeLessThan(1024 * 1024);
            
            console.log(`Initial memory footprint: ${(memoryUsed / 1024).toFixed(2)}KB`);

            // Cleanup
            gameController.dispose();
        });
    });

    describe('Bundle Size Impact', () => {
        it('should have lightweight core classes', () => {
            // Test that core classes don't have heavy dependencies
            const gameEngine = new GameEngine();
            const gameController = new GameController(mockContext);
            
            // These should create without loading heavy resources
            expect(gameEngine).toBeDefined();
            expect(gameController).toBeDefined();
            
            // Verify they have minimal initial state
            expect(Object.keys(gameEngine).length).toBeLessThan(10);
            expect(Object.keys(gameController).length).toBeLessThan(15);

            // Cleanup
            gameController.dispose();
        });

        it('should defer HTML generation until webview is needed', () => {
            const gameController = new GameController(mockContext);
            const gameViewProvider = new GameViewProvider(mockContext.extensionUri, gameController);
            
            // HTML should not be generated during provider creation
            expect(mockWebview.html).toBe('');
            
            // Only generate HTML when webview is resolved
            gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            
            // Now HTML should be generated
            expect(mockWebview.html).toContain('2048 Game');
            expect(mockWebview.html.length).toBeGreaterThan(1000);

            // Cleanup
            gameController.dispose();
        });

        it('should use efficient data structures', () => {
            const gameEngine = new GameEngine();
            
            // Board should be efficiently represented
            const board = gameEngine.board;
            expect(Array.isArray(board)).toBe(true);
            expect(board.length).toBe(4);
            expect(board[0].length).toBe(4);
            
            // State should be minimal
            const state = gameEngine.getGameState();
            const stateKeys = Object.keys(state);
            expect(stateKeys.length).toBeLessThan(10);
            
            // Serialization should be efficient
            const serialized = JSON.stringify(state);
            expect(serialized.length).toBeLessThan(500);
            
            console.log(`Game state serialization size: ${serialized.length} bytes`);
        });
    });

    describe('Concurrent Loading Performance', () => {
        it('should handle multiple simultaneous activations efficiently', async () => {
            const activationPromises = [];
            const startTime = performance.now();
            
            // Simulate multiple extensions activating simultaneously
            for (let i = 0; i < 5; i++) {
                const promise = new Promise<number>((resolve) => {
                    const componentStartTime = performance.now();
                    
                    const gameController = new GameController(mockContext);
                    const gameViewProvider = new GameViewProvider(mockContext.extensionUri, gameController);
                    gameController.setGameViewProvider(gameViewProvider);
                    
                    const componentEndTime = performance.now();
                    gameController.dispose();
                    
                    resolve(componentEndTime - componentStartTime);
                });
                
                activationPromises.push(promise);
            }
            
            const activationTimes = await Promise.all(activationPromises);
            const totalTime = performance.now() - startTime;
            
            // All activations should complete quickly
            activationTimes.forEach((time, index) => {
                expect(time).toBeLessThan(10);
                console.log(`Activation ${index + 1}: ${time.toFixed(2)}ms`);
            });
            
            expect(totalTime).toBeLessThan(50);
            console.log(`Total concurrent activation time: ${totalTime.toFixed(2)}ms`);
        });

        it('should not block other extensions during activation', () => {
            const blockingOperations = [];
            
            // Mock potentially blocking operations
            const originalSetTimeout = global.setTimeout;
            global.setTimeout = vi.fn((callback, delay) => {
                if (delay > 10) {
                    blockingOperations.push(delay);
                }
                return originalSetTimeout(callback, delay);
            });
            
            const startTime = performance.now();
            
            const gameController = new GameController(mockContext);
            const gameViewProvider = new GameViewProvider(mockContext.extensionUri, gameController);
            gameController.setGameViewProvider(gameViewProvider);
            
            const endTime = performance.now();
            
            // Restore setTimeout
            global.setTimeout = originalSetTimeout;
            
            // Should not use long timeouts during activation
            expect(blockingOperations.length).toBe(0);
            expect(endTime - startTime).toBeLessThan(5);
            
            console.log(`Non-blocking activation: ${(endTime - startTime).toFixed(2)}ms, ${blockingOperations.length} blocking operations`);

            // Cleanup
            gameController.dispose();
        });
    });

    describe('Cold Start Performance', () => {
        it('should start efficiently on first run', () => {
            // Simulate first run (no saved state, no cache)
            mockContext.globalState.get = vi.fn().mockReturnValue(undefined);
            
            const startTime = performance.now();
            
            const gameController = new GameController(mockContext);
            gameController.initialize();
            
            const gameViewProvider = new GameViewProvider(mockContext.extensionUri, gameController);
            gameController.setGameViewProvider(gameViewProvider);
            
            // Resolve webview (full initialization)
            gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            
            const endTime = performance.now();
            const coldStartTime = endTime - startTime;
            
            // Cold start should still be reasonable
            expect(coldStartTime).toBeLessThan(30);
            
            console.log(`Cold start time: ${coldStartTime.toFixed(2)}ms`);

            // Cleanup
            gameController.dispose();
        });

        it('should warm up efficiently on subsequent runs', () => {
            // First run
            const gameController1 = new GameController(mockContext);
            gameController1.initialize();
            gameController1.dispose();
            
            // Second run (simulating warm start)
            const startTime = performance.now();
            
            const gameController2 = new GameController(mockContext);
            gameController2.initialize();
            
            const gameViewProvider = new GameViewProvider(mockContext.extensionUri, gameController2);
            gameController2.setGameViewProvider(gameViewProvider);
            
            gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            
            const endTime = performance.now();
            const warmStartTime = endTime - startTime;
            
            // Warm start should be faster than cold start
            expect(warmStartTime).toBeLessThan(25);
            
            console.log(`Warm start time: ${warmStartTime.toFixed(2)}ms`);

            // Cleanup
            gameController2.dispose();
        });
    });
});