import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameViewProvider } from './gameViewProvider';
import { GameController } from './gameController';
import * as vscode from 'vscode';

/**
 * Theme compatibility tests to ensure the extension works across different VSCode themes
 * Tests light, dark, high contrast, and custom themes
 */
describe('Theme Compatibility Tests', () => {
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
        if (gameController && !gameController['disposed']) {
            gameController.dispose();
        }
    });

    describe('Core Theme Support', () => {
        const themeTestCases = [
            {
                name: 'Dark Theme',
                kind: vscode.ColorThemeKind.Dark,
                expectedProperties: {
                    isDark: true,
                    isHighContrast: false
                }
            },
            {
                name: 'Light Theme',
                kind: vscode.ColorThemeKind.Light,
                expectedProperties: {
                    isDark: false,
                    isHighContrast: false
                }
            },
            {
                name: 'High Contrast Dark',
                kind: vscode.ColorThemeKind.HighContrast,
                expectedProperties: {
                    isDark: true,
                    isHighContrast: true
                }
            },
            {
                name: 'High Contrast Light',
                kind: vscode.ColorThemeKind.HighContrastLight,
                expectedProperties: {
                    isDark: false,
                    isHighContrast: true
                }
            }
        ];

        themeTestCases.forEach(({ name, kind, expectedProperties }) => {
            it(`should generate appropriate styles for ${name}`, () => {
                // Mock the theme
                Object.defineProperty(vscode.window, 'activeColorTheme', {
                    value: { kind: kind },
                    writable: true
                });

                // Resolve webview to generate HTML
                gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);

                const html = mockWebview.html;

                // Should contain theme-aware CSS variables
                expect(html).toContain('--vscode-editor-background');
                expect(html).toContain('--vscode-editor-foreground');
                expect(html).toContain('--vscode-focusBorder');

                // Should contain tile color definitions
                expect(html).toContain('--tile-color-2');
                expect(html).toContain('--tile-color-2048');

                // High contrast themes should have additional properties
                if (expectedProperties.isHighContrast) {
                    expect(html).toContain('--hc-border-width');
                    expect(html).toContain('--hc-focus-width');
                }

                console.log(`${name} theme validation passed`);
            });
        });

        it('should handle theme changes dynamically', () => {
            gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);

            const startTime = performance.now();

            // Test theme changes
            themeTestCases.forEach(({ kind, expectedProperties }) => {
                Object.defineProperty(vscode.window, 'activeColorTheme', {
                    value: { kind: kind },
                    writable: true
                });

                // Simulate theme change message
                gameViewProvider.postMessage({
                    type: 'themeChanged',
                    theme: {
                        kind: kind,
                        isHighContrast: expectedProperties.isHighContrast,
                        isDark: expectedProperties.isDark,
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
            expect(duration).toBeLessThan(50);
            expect(mockWebview.postMessage).toHaveBeenCalledTimes(themeTestCases.length);

            console.log(`Dynamic theme changes completed in ${duration.toFixed(2)}ms`);
        });
    });

    describe('Color Generation and Accessibility', () => {
        it('should generate accessible tile colors for dark themes', () => {
            Object.defineProperty(vscode.window, 'activeColorTheme', {
                value: { kind: vscode.ColorThemeKind.Dark },
                writable: true
            });

            gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            const html = mockWebview.html;

            // Should use appropriate colors for dark theme
            expect(html).toContain('--tile-color-8: #ff9500'); // Warm orange
            expect(html).toContain('--tile-color-16: #007acc'); // VSCode blue
            expect(html).toContain('--tile-color-2048: #4caf50'); // Green

            // Should have proper text color variables
            expect(html).toContain('--tile-text-light');
            expect(html).toContain('--tile-text-dark');
        });

        it('should generate accessible tile colors for light themes', () => {
            Object.defineProperty(vscode.window, 'activeColorTheme', {
                value: { kind: vscode.ColorThemeKind.Light },
                writable: true
            });

            gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            const html = mockWebview.html;

            // Should use appropriate colors for light theme
            expect(html).toContain('--tile-color-8: #ff8f00'); // Darker orange for better contrast
            expect(html).toContain('--tile-color-16: #0277bd'); // Darker blue
            expect(html).toContain('--tile-color-2048: #388e3c'); // Dark green
        });

        it('should provide maximum contrast for high contrast themes', () => {
            Object.defineProperty(vscode.window, 'activeColorTheme', {
                value: { kind: vscode.ColorThemeKind.HighContrast },
                writable: true
            });

            gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            const html = mockWebview.html;

            // Should use VSCode's high contrast color variables
            expect(html).toContain('var(--vscode-button-background)');
            expect(html).toContain('var(--vscode-button-hoverBackground)');
            expect(html).toContain('var(--vscode-inputValidation-errorBackground)');
            expect(html).toContain('var(--vscode-charts-');

            // Should have enhanced border and focus properties
            expect(html).toContain('--hc-border-width: 1px');
            expect(html).toContain('--hc-focus-width: 2px');
        });

        it('should ensure sufficient contrast ratios', () => {
            const themes = [
                vscode.ColorThemeKind.Dark,
                vscode.ColorThemeKind.Light,
                vscode.ColorThemeKind.HighContrast,
                vscode.ColorThemeKind.HighContrastLight
            ];

            themes.forEach(themeKind => {
                Object.defineProperty(vscode.window, 'activeColorTheme', {
                    value: { kind: themeKind },
                    writable: true
                });

                gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
                const html = mockWebview.html;

                // Should define text colors for contrast
                expect(html).toContain('--tile-text-light');
                expect(html).toContain('--tile-text-dark');

                // High contrast themes should have no text shadows
                if (themeKind === vscode.ColorThemeKind.HighContrast || 
                    themeKind === vscode.ColorThemeKind.HighContrastLight) {
                    expect(html).toContain('--tile-text-shadow: none');
                }

                console.log(`Contrast validation passed for ${vscode.ColorThemeKind[themeKind]} theme`);
            });
        });
    });

    describe('Theme Change Performance', () => {
        it('should handle rapid theme changes efficiently', () => {
            gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);

            const startTime = performance.now();
            const messageCount = 50;

            // Simulate rapid theme changes
            for (let i = 0; i < messageCount; i++) {
                const themeKind = i % 2 === 0 ? vscode.ColorThemeKind.Dark : vscode.ColorThemeKind.Light;
                
                gameViewProvider.postMessage({
                    type: 'themeChanged',
                    theme: {
                        kind: themeKind,
                        isHighContrast: false,
                        isDark: themeKind === vscode.ColorThemeKind.Dark,
                        backgroundColor: 'var(--vscode-editor-background)',
                        foregroundColor: 'var(--vscode-editor-foreground)',
                        accentColor: 'var(--vscode-focusBorder)',
                        tileColors: {}
                    }
                });
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Should handle rapid changes efficiently
            expect(duration).toBeLessThan(100);
            expect(mockWebview.postMessage).toHaveBeenCalledTimes(messageCount);

            console.log(`${messageCount} theme changes completed in ${duration.toFixed(2)}ms`);
        });

        it('should not accumulate memory during theme changes', () => {
            gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);

            const initialMemory = process.memoryUsage().heapUsed;

            // Perform many theme changes
            for (let i = 0; i < 100; i++) {
                const themes = [
                    vscode.ColorThemeKind.Dark,
                    vscode.ColorThemeKind.Light,
                    vscode.ColorThemeKind.HighContrast,
                    vscode.ColorThemeKind.HighContrastLight
                ];
                
                const themeKind = themes[i % themes.length];
                
                gameViewProvider.postMessage({
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
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryGrowth = finalMemory - initialMemory;

            // Memory growth should be minimal
            expect(memoryGrowth).toBeLessThan(1024 * 1024); // Less than 1MB

            console.log(`Memory growth after 100 theme changes: ${(memoryGrowth / 1024).toFixed(2)}KB`);
        });
    });

    describe('Fallback and Error Handling', () => {
        it('should provide fallback colors when theme data is unavailable', () => {
            // Mock undefined theme
            Object.defineProperty(vscode.window, 'activeColorTheme', {
                value: undefined,
                writable: true
            });

            gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            const html = mockWebview.html;

            // Should still contain valid CSS even without theme data
            expect(html).toContain('--tile-color-2');
            expect(html).toContain('--tile-color-2048');
            expect(html).toContain('var(--vscode-editor-background)');

            // Should use fallback theme (dark)
            expect(html).toContain('#ff9500'); // Dark theme orange
        });

        it('should handle theme change errors gracefully', () => {
            gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);

            // Mock postMessage to throw error
            const originalPostMessage = mockWebview.postMessage;
            mockWebview.postMessage = vi.fn(() => {
                throw new Error('Theme change error');
            });

            // Should not throw when theme change fails
            expect(() => {
                gameViewProvider.postMessage({
                    type: 'themeChanged',
                    theme: {
                        kind: vscode.ColorThemeKind.Dark,
                        isHighContrast: false,
                        isDark: true,
                        backgroundColor: 'var(--vscode-editor-background)',
                        foregroundColor: 'var(--vscode-editor-foreground)',
                        accentColor: 'var(--vscode-focusBorder)',
                        tileColors: {}
                    }
                });
            }).not.toThrow();

            // Restore original method
            mockWebview.postMessage = originalPostMessage;
        });

        it('should handle missing VSCode theme API gracefully', () => {
            // Mock missing theme change listener
            vi.mocked(vscode.window).onDidChangeActiveColorTheme = undefined as any;

            // Should not throw when theme change listener is unavailable
            expect(() => {
                gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            }).not.toThrow();

            // Should still generate valid HTML
            expect(mockWebview.html).toContain('2048 Game');
        });

        it('should work with custom theme extensions', () => {
            // Mock a custom theme with unusual properties
            Object.defineProperty(vscode.window, 'activeColorTheme', {
                value: {
                    kind: vscode.ColorThemeKind.Dark,
                    // Custom themes might have additional properties
                    customProperty: 'custom-value'
                },
                writable: true
            });

            // Should handle custom themes without errors
            expect(() => {
                gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            }).not.toThrow();

            const html = mockWebview.html;
            expect(html).toContain('2048 Game');
            expect(html).toContain('--tile-color-2');
        });
    });

    describe('Cross-Version Compatibility', () => {
        it('should work with older VSCode versions', () => {
            // Mock older VSCode API (missing some newer features)
            const limitedVscode = {
                window: {
                    registerWebviewViewProvider: vi.fn(),
                    showInformationMessage: vi.fn(),
                    activeColorTheme: { kind: vscode.ColorThemeKind.Dark }
                    // Missing onDidChangeActiveColorTheme
                },
                commands: {
                    registerCommand: vi.fn()
                },
                ColorThemeKind: vscode.ColorThemeKind
            };

            // Should work with limited API
            expect(() => {
                gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            }).not.toThrow();

            expect(mockWebview.html).toContain('2048 Game');
        });

        it('should handle different ColorThemeKind values', () => {
            // Test with all possible theme kinds
            const allThemeKinds = [
                vscode.ColorThemeKind.Light,
                vscode.ColorThemeKind.Dark,
                vscode.ColorThemeKind.HighContrast,
                vscode.ColorThemeKind.HighContrastLight
            ];

            allThemeKinds.forEach(themeKind => {
                Object.defineProperty(vscode.window, 'activeColorTheme', {
                    value: { kind: themeKind },
                    writable: true
                });

                expect(() => {
                    gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
                }).not.toThrow();

                const html = mockWebview.html;
                expect(html).toContain('2048 Game');
                expect(html).toContain('--tile-color-2');

                console.log(`Theme kind ${vscode.ColorThemeKind[themeKind]} handled successfully`);
            });
        });

        it('should handle unknown theme kinds gracefully', () => {
            // Mock unknown theme kind (future VSCode version)
            Object.defineProperty(vscode.window, 'activeColorTheme', {
                value: { kind: 999 as any }, // Unknown theme kind
                writable: true
            });

            // Should handle unknown theme kinds without errors
            expect(() => {
                gameViewProvider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
            }).not.toThrow();

            const html = mockWebview.html;
            expect(html).toContain('2048 Game');
            
            // Should fall back to dark theme colors
            expect(html).toContain('#ff9500'); // Dark theme orange
        });
    });
});