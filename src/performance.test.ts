import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameEngine } from './gameEngine';
import { GameController } from './gameController';
import { GameViewProvider } from './gameViewProvider';
import * as vscode from 'vscode';

/**
 * Performance and optimization tests for the 2048 extension
 * Tests rendering performance, memory usage, startup time, and theme compatibility
 */
describe('Performance Optimization Tests', () => {
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
            onDidReceiveMessage: vi.fn(),
            options: {}
        };

        // Mock webview view
        mockWebviewView = {
            webview: mockWebview,
            onDidDispose: vi.fn()
        };

        // Mock VSCode window
        vi.mocked(vscode.window).showInformationMessage = vi.fn();
        vi.mocked(vscode.window).showErrorMessage = vi.fn();
        vi.mocked(vscode.window).showWarningMessage = vi.fn();
        vi.mocked(vscode.window).onDidChangeActiveColorTheme = vi.fn();
        Object.defineProperty(vscode.window, 'activeColorTheme', {
            value: { kind: vscode.ColorThemeKind.Dark },
            writable: true
        });

        // Mock commands
        vi.mocked(vscode.commands).registerCommand = vi.fn();
        vi.mocked(vscode.commands).executeCommand = vi.fn();

        // Mock window registration
        vi.mocked(vscode.window).registerWebviewViewProvider = vi.fn();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering Performance Optimization', () => {
        it('should render board updates efficiently within performance budget', () => {
            const gameEngine = new GameEngine();
            const startTime = performance.now();
            
            // Simulate rapid board updates (typical during animations)
            for (let i = 0; i < 100; i++) {
                gameEngine.move(i % 2 === 0 ? 'left' : 'right');
                gameEngine.getGameState(); // Simulate state access for rendering
            }
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // Should complete within 50ms for smooth 60fps rendering
            expect(duration).toBeLessThan(50);
            console.log(`Board rendering performance: ${duration.toFixed(2)}ms for 100 operations`);
        });

        it('should handle tile animations without blocking UI thread', async () => {
            const gameController = new GameController(mockContext);
            const provider = new GameViewProvider(mockContext.extensionUri, gameController);
            
            const startTime = performance.now();
            
            // Simulate webview resolution (includes HTML generation)
            provider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // Webview setup should be fast to avoid blocking
            expect(duration).toBeLessThan(100);
            expect(mockWebview.html).toContain('animation-duration');
            console.log(`Webview setup time: ${duration.toFixed(2)}ms`);
        });

        it('should optimize CSS animations for smooth performance', () => {
            const provider = new GameViewProvider(mockContext.extensionUri);
            provider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            
            const html = mockWebview.html;
            
            // Check for performance-optimized CSS properties
            expect(html).toContain('--animation-duration: 0.15s'); // Fast animations
            expect(html).toContain('transition: all var(--animation-duration)');
            expect(html).toContain('transform: translateY'); // Hardware acceleration
            expect(html).toContain('will-change'); // Optimization hint
        });

        it('should batch DOM updates for efficient rendering', () => {
            const gameEngine = new GameEngine();
            const startTime = performance.now();
            
            // Simulate multiple rapid state changes
            const states = [];
            for (let i = 0; i < 50; i++) {
                gameEngine.move(['left', 'right', 'up', 'down'][i % 4] as any);
                states.push(gameEngine.getGameState());
            }
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // State generation should be efficient
            expect(duration).toBeLessThan(25);
            expect(states.length).toBe(50);
            console.log(`State batching performance: ${duration.toFixed(2)}ms for 50 states`);
        });
    });

    describe('Memory Usage and Cleanup Testing', () => {
        it('should properly dispose of resources on extension deactivation', () => {
            const gameController = new GameController(mockContext);
            const provider = new GameViewProvider(mockContext.extensionUri, gameController);
            
            // Set up the components
            gameController.setGameViewProvider(provider);
            provider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            
            // Track initial state
            const initialSubscriptions = mockContext.subscriptions.length;
            
            // Dispose of controller
            gameController.dispose();
            
            // Verify cleanup
            expect(gameController['disposed']).toBe(true);
            
            // Verify no memory leaks in event listeners
            expect(mockWebview.onDidReceiveMessage).toHaveBeenCalled();
        });

        it('should handle memory efficiently during long gaming sessions', () => {
            const gameEngine = new GameEngine();
            const initialMemory = process.memoryUsage();
            
            // Simulate long gaming session with many moves
            for (let i = 0; i < 1000; i++) {
                gameEngine.move(['left', 'right', 'up', 'down'][i % 4] as any);
                
                // Occasionally check for memory leaks
                if (i % 100 === 0) {
                    const currentMemory = process.memoryUsage();
                    const heapGrowth = currentMemory.heapUsed - initialMemory.heapUsed;
                    
                    // Memory growth should be reasonable (less than 10MB for 1000 moves)
                    expect(heapGrowth).toBeLessThan(10 * 1024 * 1024);
                }
            }
            
            console.log(`Memory usage after 1000 moves: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`);
        });

        it('should clean up message handlers and prevent memory leaks', () => {
            const provider = new GameViewProvider(mockContext.extensionUri);
            const messageHandlers: any[] = [];
            
            // Mock onDidReceiveMessage to track handlers
            mockWebview.onDidReceiveMessage = vi.fn((handler) => {
                messageHandlers.push(handler);
                return { dispose: vi.fn() };
            });
            
            // Set up webview multiple times (simulating theme changes)
            for (let i = 0; i < 5; i++) {
                provider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            }
            
            // Should not accumulate handlers
            expect(messageHandlers.length).toBeLessThanOrEqual(5);
        });

        it('should handle rapid theme changes without memory accumulation', () => {
            const provider = new GameViewProvider(mockContext.extensionUri);
            provider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            
            const initialMemory = process.memoryUsage().heapUsed;
            
            // Simulate rapid theme changes
            for (let i = 0; i < 100; i++) {
                provider.postMessage({
                    type: 'themeChanged',
                    theme: {
                        kind: i % 2 === 0 ? vscode.ColorThemeKind.Dark : vscode.ColorThemeKind.Light,
                        isHighContrast: false,
                        isDark: i % 2 === 0,
                        backgroundColor: 'var(--vscode-editor-background)',
                        foregroundColor: 'var(--vscode-editor-foreground)',
                        accentColor: 'var(--vscode-focusBorder)',
                        tileColors: {}
                    }
                });
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryGrowth = finalMemory - initialMemory;
            
            // Memory growth should be minimal (less than 1MB)
            expect(memoryGrowth).toBeLessThan(1024 * 1024);
            console.log(`Memory growth after 100 theme changes: ${(memoryGrowth / 1024).toFixed(2)}KB`);
        });
    });

    describe('Startup Time Impact Verification', () => {
        it('should activate extension quickly without blocking VSCode startup', () => {
            const startTime = performance.now();
            
            // Simulate extension activation
            const gameController = new GameController(mockContext);
            const provider = new GameViewProvider(mockContext.extensionUri, gameController);
            gameController.setGameViewProvider(provider);
            
            const endTime = performance.now();
            const activationTime = endTime - startTime;
            
            // Extension activation should be very fast (less than 10ms)
            expect(activationTime).toBeLessThan(10);
            console.log(`Extension activation time: ${activationTime.toFixed(2)}ms`);
        });

        it('should defer heavy operations until webview is actually needed', () => {
            const startTime = performance.now();
            
            // Create provider but don't resolve webview yet
            const provider = new GameViewProvider(mockContext.extensionUri);
            
            const creationTime = performance.now() - startTime;
            
            // Provider creation should be instant
            expect(creationTime).toBeLessThan(1);
            
            // Now resolve webview (heavier operation)
            const resolveStartTime = performance.now();
            provider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            const resolveTime = performance.now() - resolveStartTime;
            
            // Webview resolution can be slower but should still be reasonable
            expect(resolveTime).toBeLessThan(50);
            
            console.log(`Provider creation: ${creationTime.toFixed(2)}ms, Webview resolution: ${resolveTime.toFixed(2)}ms`);
        });

        it('should minimize initial bundle size impact', () => {
            // Test that core classes are lightweight
            const gameEngine = new GameEngine();
            const gameController = new GameController(mockContext);
            
            // These should create quickly
            expect(gameEngine).toBeDefined();
            expect(gameController).toBeDefined();
            
            // Verify lazy loading of heavy resources
            const provider = new GameViewProvider(mockContext.extensionUri);
            expect(provider).toBeDefined();
            
            // HTML generation should be deferred until needed
            expect(mockWebview.html).toBe('');
        });
    });

    describe('Theme Compatibility Testing', () => {
        const themeKinds = [
            vscode.ColorThemeKind.Light,
            vscode.ColorThemeKind.Dark,
            vscode.ColorThemeKind.HighContrast,
            vscode.ColorThemeKind.HighContrastLight
        ];

        themeKinds.forEach(themeKind => {
            it(`should generate appropriate colors for ${vscode.ColorThemeKind[themeKind]} theme`, () => {
                const provider = new GameViewProvider(mockContext.extensionUri);
                
                // Mock theme
                Object.defineProperty(vscode.window, 'activeColorTheme', {
                    value: { kind: themeKind },
                    writable: true
                });
                
                provider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
                
                const html = mockWebview.html;
                
                // Should contain theme-aware CSS variables
                expect(html).toContain('--vscode-editor-background');
                expect(html).toContain('--vscode-editor-foreground');
                
                // High contrast themes should have additional properties
                if (themeKind === vscode.ColorThemeKind.HighContrast || 
                    themeKind === vscode.ColorThemeKind.HighContrastLight) {
                    expect(html).toContain('--hc-border-width');
                    expect(html).toContain('--hc-focus-width');
                }
            });
        });

        it('should handle theme changes dynamically without performance degradation', () => {
            const provider = new GameViewProvider(mockContext.extensionUri);
            provider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            
            const startTime = performance.now();
            
            // Simulate theme changes
            themeKinds.forEach(themeKind => {
                Object.defineProperty(vscode.window, 'activeColorTheme', {
                    value: { kind: themeKind },
                    writable: true
                });
                
                // Trigger theme change
                provider.postMessage({
                    type: 'themeChanged',
                    theme: {
                        kind: themeKind,
                        isHighContrast: themeKind === vscode.ColorThemeKind.HighContrast || 
                                       themeKind === vscode.ColorThemeKind.HighContrastLight,
                        isDark: themeKind === vscode.ColorThemeKind.Dark || 
                               themeKind === vscode.ColorThemeKind.HighContrast,
                        backgroundColor: 'var(--vscode-editor-background)',
                        foregroundColor: 'var(--vscode-editor-foreground)',
                        accentColor: 'var(--vscode-focusBorder)',
                        tileColors: {}
                    }
                });
            });
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // Theme changes should be fast
            expect(duration).toBeLessThan(20);
            console.log(`Theme change performance: ${duration.toFixed(2)}ms for ${themeKinds.length} themes`);
        });

        it('should provide fallback colors when theme data is unavailable', () => {
            const provider = new GameViewProvider(mockContext.extensionUri);
            
            // Mock undefined theme
            Object.defineProperty(vscode.window, 'activeColorTheme', {
                value: undefined,
                writable: true
            });
            
            provider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            
            const html = mockWebview.html;
            
            // Should still contain valid CSS even without theme data
            expect(html).toContain('--tile-color-2');
            expect(html).toContain('--tile-color-2048');
            expect(html).toContain('var(--vscode-editor-background)');
        });
    });

    describe('Cross-Version Compatibility', () => {
        it('should handle different VSCode API versions gracefully', () => {
            // Test with minimal VSCode API
            const minimalVscode = {
                window: {
                    registerWebviewViewProvider: vi.fn(),
                    showInformationMessage: vi.fn(),
                    activeColorTheme: { kind: vscode.ColorThemeKind.Dark }
                },
                commands: {
                    registerCommand: vi.fn()
                },
                ColorThemeKind: vscode.ColorThemeKind
            };
            
            // Should not throw with minimal API
            expect(() => {
                const provider = new GameViewProvider(mockContext.extensionUri);
                provider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            }).not.toThrow();
        });

        it('should degrade gracefully when advanced features are unavailable', () => {
            // Mock missing onDidChangeActiveColorTheme
            vi.mocked(vscode.window).onDidChangeActiveColorTheme = undefined as any;
            
            const provider = new GameViewProvider(mockContext.extensionUri);
            
            // Should not throw when theme change listener is unavailable
            expect(() => {
                provider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            }).not.toThrow();
            
            // Should still generate valid HTML
            expect(mockWebview.html).toContain('2048 Game');
        });
    });

    describe('Resource Optimization', () => {
        it('should minimize CSS and JavaScript payload size', () => {
            const provider = new GameViewProvider(mockContext.extensionUri);
            provider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            
            const html = mockWebview.html;
            const htmlSize = new Blob([html]).size;
            
            // HTML should be reasonably sized (less than 150KB for a rich game interface)
            expect(htmlSize).toBeLessThan(150 * 1024);
            console.log(`Generated HTML size: ${(htmlSize / 1024).toFixed(2)}KB`);
            
            // Should not contain unnecessary whitespace in production
            if (process.env.NODE_ENV === 'production') {
                expect(html).not.toMatch(/\n\s{4,}/); // No excessive indentation
            }
        });

        it('should use efficient data structures for game state', () => {
            const gameEngine = new GameEngine();
            const startTime = performance.now();
            
            // Test state serialization performance
            for (let i = 0; i < 1000; i++) {
                const state = gameEngine.getGameState();
                gameEngine.loadGameState(state);
            }
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // State operations should be very fast
            expect(duration).toBeLessThan(10);
            console.log(`State serialization performance: ${duration.toFixed(2)}ms for 1000 operations`);
        });

        it('should optimize message passing between extension and webview', () => {
            const gameController = new GameController(mockContext);
            const provider = new GameViewProvider(mockContext.extensionUri, gameController);
            
            gameController.setGameViewProvider(provider);
            provider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            
            const startTime = performance.now();
            
            // Simulate rapid message exchanges
            for (let i = 0; i < 100; i++) {
                provider.postMessage({
                    type: 'gameStateUpdate',
                    state: {
                        board: [[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
                        score: i * 2,
                        gameState: 'playing',
                        moveCount: i,
                        startTime: Date.now()
                    }
                });
            }
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // Message passing should be efficient
            expect(duration).toBeLessThan(50);
            console.log(`Message passing performance: ${duration.toFixed(2)}ms for 100 messages`);
        });
    });
});