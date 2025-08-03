import * as vscode from 'vscode';
import { GameController } from './gameController';
import { ExtensionToWebviewMessage, WebviewToExtensionMessage, MessageValidator, MessageFactory } from './messageTypes';

export class GameViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = '2048Game';

    private _view?: vscode.WebviewView;
    private _gameController?: GameController;

    constructor(private readonly _extensionUri: vscode.Uri, gameController?: GameController) {
        this._gameController = gameController;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        try {
            this._view = webviewView;

            webviewView.webview.options = {
                // Allow scripts in the webview
                enableScripts: true,
                localResourceRoots: [
                    this._extensionUri
                ]
            };

            webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

            // Handle messages from the webview
            webviewView.webview.onDidReceiveMessage(
                message => {
                    try {
                        this.handleMessage(message);
                    } catch (error) {
                        console.error('Error handling webview message:', error);
                        this.sendErrorMessage('Failed to process message', 'MESSAGE_PROCESSING_ERROR');
                    }
                },
                undefined,
                []
            );

            // Set up automatic theme change detection
            this.setupThemeChangeListener();

            // Send initial theme data and process any queued messages
            setTimeout(() => {
                this.sendThemeData();
                this.processMessageQueue();
            }, 100);
        } catch (error) {
            console.error('Error resolving webview view:', error);
            vscode.window.showErrorMessage('Failed to initialize 2048 game view');

            // Fallback: create a simple error view
            try {
                if (webviewView && webviewView.webview) {
                    webviewView.webview.html = this._getErrorHtml('Failed to initialize game');
                }
            } catch (fallbackError) {
                console.error('Error setting fallback HTML:', fallbackError);
                // If we can't even set error HTML, there's nothing more we can do
            }
        }
    }

    public postMessage(message: ExtensionToWebviewMessage): void {
        try {
            // Validate message before sending
            if (!MessageValidator.isValidExtensionMessage(message)) {
                console.error('Invalid message format:', message);
                return;
            }

            if (this._view) {
                this._view.webview.postMessage(message);
                console.log('Message sent to webview:', message.type);
            } else {
                console.warn('Attempted to post message to undefined webview');
                // Queue message for when webview becomes available
                this.queueMessage(message);
            }
        } catch (error) {
            console.error('Error posting message to webview:', error);
            this.handlePostMessageError(message, error);
        }
    }

    private messageQueue: ExtensionToWebviewMessage[] = [];

    private queueMessage(message: ExtensionToWebviewMessage): void {
        this.messageQueue.push(message);
        console.log(`Message queued: ${message.type} (queue size: ${this.messageQueue.length})`);
    }

    private processMessageQueue(): void {
        if (this._view && this.messageQueue.length > 0) {
            const messagesToProcess = [...this.messageQueue];
            this.messageQueue = [];

            messagesToProcess.forEach(message => {
                this.postMessage(message);
            });
        }
    }

    private handlePostMessageError(message: ExtensionToWebviewMessage, error: any): void {
        console.error(`Failed to send message ${message.type}:`, error);

        // Try to send error notification to webview if possible
        try {
            const errorMessage = MessageFactory.createErrorMessage(
                `Failed to send ${message.type} message`,
                'MESSAGE_SEND_FAILED',
                true
            );

            if (this._view) {
                this._view.webview.postMessage(errorMessage);
            }
        } catch (secondaryError) {
            console.error('Failed to send error message:', secondaryError);
        }
    }

    private handleMessage(message: any): void {
        try {
            // Validate incoming message
            if (!MessageValidator.isValidWebviewMessage(message)) {
                console.error('Invalid message received from webview:', message);
                this.sendErrorMessage('Invalid message format', 'INVALID_MESSAGE_FORMAT');
                return;
            }

            const webviewMessage = message as WebviewToExtensionMessage;
            console.log('Handling webview message:', webviewMessage.type);

            switch (webviewMessage.type) {
                case 'requestNewGame':
                    this.handleNewGameRequest(webviewMessage);
                    break;
                case 'gameMove':
                    this.handleGameMove(webviewMessage);
                    break;
                case 'gameStateUpdate':
                    this.handleGameStateUpdate(webviewMessage);
                    break;
                case 'requestTheme':
                    this.handleThemeRequest(webviewMessage);
                    break;
                case 'requestSavedGame':
                    this.handleSavedGameRequest(webviewMessage);
                    break;
                case 'shareScore':
                    this.handleShareScore(webviewMessage);
                    break;
                case 'error':
                    this.handleWebviewError(webviewMessage);
                    break;
                default:
                    console.warn('Unknown message type:', webviewMessage.type);
                    this.sendErrorMessage(`Unknown message type: ${webviewMessage.type}`, 'UNKNOWN_MESSAGE_TYPE');
            }
        } catch (error) {
            console.error('Error in handleMessage:', error);
            this.sendErrorMessage('Failed to process message', 'MESSAGE_PROCESSING_ERROR');
        }
    }

    private handleNewGameRequest(message: WebviewToExtensionMessage): void {
        try {
            if (this._gameController) {
                this._gameController.handleMessage(message);
            } else {
                vscode.commands.executeCommand('2048Game.newGame');
            }
        } catch (error) {
            console.error('Error handling new game request:', error);
            this.sendErrorMessage('Failed to start new game', 'NEW_GAME_FAILED');
        }
    }

    private handleGameMove(message: WebviewToExtensionMessage): void {
        try {
            if (!message.direction) {
                this.sendErrorMessage('Game move missing direction', 'INVALID_MOVE');
                return;
            }

            if (this._gameController) {
                this._gameController.handleMessage(message);
            } else {
                console.log('Game move:', message.direction);
                this.sendErrorMessage('Game controller not available', 'CONTROLLER_UNAVAILABLE');
            }
        } catch (error) {
            console.error('Error handling game move:', error);
            this.sendErrorMessage('Failed to process game move', 'MOVE_PROCESSING_ERROR');
        }
    }

    private handleGameStateUpdate(message: WebviewToExtensionMessage): void {
        try {
            if (!message.state) {
                this.sendErrorMessage('Game state update missing state data', 'INVALID_STATE_UPDATE');
                return;
            }

            if (this._gameController) {
                this._gameController.handleMessage(message);
            } else {
                console.log('Game state updated:', message.state);
                this.sendErrorMessage('Game controller not available', 'CONTROLLER_UNAVAILABLE');
            }
        } catch (error) {
            console.error('Error handling game state update:', error);
            this.sendErrorMessage('Failed to update game state', 'STATE_UPDATE_ERROR');
        }
    }

    private handleThemeRequest(message: WebviewToExtensionMessage): void {
        try {
            this.sendThemeData();
        } catch (error) {
            console.error('Error handling theme request:', error);
            this.sendErrorMessage('Failed to send theme data', 'THEME_REQUEST_ERROR');
        }
    }

    private handleSavedGameRequest(message: WebviewToExtensionMessage): void {
        try {
            if (this._gameController) {
                this._gameController.handleMessage(message);
            } else {
                this.sendErrorMessage('Game controller not available', 'CONTROLLER_UNAVAILABLE');
            }
        } catch (error) {
            console.error('Error handling saved game request:', error);
            this.sendErrorMessage('Failed to load saved game', 'SAVED_GAME_ERROR');
        }
    }

    private handleShareScore(message: WebviewToExtensionMessage): void {
        try {
            if (!message.shareData) {
                this.sendErrorMessage('Share score missing share data', 'INVALID_SHARE_DATA');
                return;
            }

            // Forward to game controller if available
            if (this._gameController) {
                this._gameController.handleMessage(message);
            } else {
                console.log('Share score request:', message.shareData);
                this.sendErrorMessage('Game controller not available', 'CONTROLLER_UNAVAILABLE');
            }

        } catch (error) {
            console.error('Error handling share score:', error);
            this.sendErrorMessage('Failed to process share request', 'SHARE_PROCESSING_ERROR');
        }
    }

    private handleWebviewError(message: WebviewToExtensionMessage): void {
        try {
            console.error('Error reported by webview:', message.error);

            // Log error details for debugging
            if (message.error) {
                console.error('Webview error details:', {
                    message: message.error.message,
                    stack: message.error.stack,
                    context: message.error.context
                });
            }

            // Could potentially show user notification for critical errors
            if (message.error?.context?.type === 'critical') {
                vscode.window.showErrorMessage(`2048 Game Error: ${message.error.message}`);
            }
        } catch (error) {
            console.error('Error handling webview error:', error);
        }
    }

    private sendErrorMessage(message: string, code?: string, recoverable: boolean = true): void {
        const errorMessage = MessageFactory.createErrorMessage(message, code, recoverable);
        this.postMessage(errorMessage);
    }

    private sendThemeData(): void {
        try {
            // Get current theme colors from VSCode
            const theme = vscode.window?.activeColorTheme;
            const themeKind = theme?.kind || vscode.ColorThemeKind.Dark;

            // Determine if we're in a high contrast theme
            const isHighContrast = themeKind === vscode.ColorThemeKind.HighContrast ||
                themeKind === vscode.ColorThemeKind.HighContrastLight;

            const themeData = {
                kind: themeKind,
                isHighContrast: isHighContrast,
                isDark: themeKind === vscode.ColorThemeKind.Dark || themeKind === vscode.ColorThemeKind.HighContrast,
                backgroundColor: 'var(--vscode-editor-background)',
                foregroundColor: 'var(--vscode-editor-foreground)',
                accentColor: 'var(--vscode-focusBorder)',
                tileColors: this.generateTileColors(themeKind)
            };

            const themeMessage = MessageFactory.createExtensionMessage('themeChanged', {
                theme: themeData
            });

            this.postMessage(themeMessage);
        } catch (error) {
            console.error('Error sending theme data:', error);
            this.sendFallbackTheme();
        }
    }

    private sendFallbackTheme(): void {
        try {
            const fallbackThemeData = {
                kind: vscode.ColorThemeKind.Dark,
                isHighContrast: false,
                isDark: true,
                backgroundColor: 'var(--vscode-editor-background)',
                foregroundColor: 'var(--vscode-editor-foreground)',
                accentColor: 'var(--vscode-focusBorder)',
                tileColors: this.generateTileColors(vscode.ColorThemeKind.Dark)
            };

            const fallbackMessage = MessageFactory.createExtensionMessage('themeChanged', {
                theme: fallbackThemeData
            });

            this.postMessage(fallbackMessage);
        } catch (error) {
            console.error('Error sending fallback theme:', error);
            this.sendErrorMessage('Failed to load theme data', 'THEME_LOAD_ERROR');
        }
    }

    private generateTileColors(themeKind: vscode.ColorThemeKind): { [value: number]: string } {
        // Generate theme-aware tile colors based on theme kind
        const isHighContrast = themeKind === vscode.ColorThemeKind.HighContrast ||
            themeKind === vscode.ColorThemeKind.HighContrastLight;
        const isDark = themeKind === vscode.ColorThemeKind.Dark || themeKind === vscode.ColorThemeKind.HighContrast;

        if (isHighContrast) {
            // High contrast theme - use maximum contrast colors with clear distinctions
            return {
                2: 'var(--vscode-button-background)',
                4: 'var(--vscode-button-hoverBackground)',
                8: 'var(--vscode-inputValidation-warningBackground)',
                16: 'var(--vscode-inputValidation-infoBackground)',
                32: 'var(--vscode-inputValidation-errorBackground)',
                64: 'var(--vscode-charts-orange)',
                128: 'var(--vscode-charts-yellow)',
                256: 'var(--vscode-charts-red)',
                512: 'var(--vscode-charts-purple)',
                1024: 'var(--vscode-charts-blue)',
                2048: 'var(--vscode-charts-green)',
                // Extended values for higher tiles
                4096: 'var(--vscode-charts-foreground)',
                8192: 'var(--vscode-errorForeground)'
            };
        } else if (isDark) {
            // Dark theme - warmer, more vibrant colors that work well on dark backgrounds
            return {
                2: 'var(--vscode-button-background)',
                4: 'var(--vscode-button-hoverBackground)',
                8: '#ff9500', // Warm orange
                16: '#007acc', // VSCode blue
                32: '#ff6b6b', // Warm red
                64: '#ffa726', // Bright orange
                128: '#ffeb3b', // Bright yellow
                256: '#f44336', // Strong red
                512: '#9c27b0', // Purple
                1024: '#2196f3', // Blue
                2048: '#4caf50', // Green
                // Extended values
                4096: '#e91e63', // Pink
                8192: '#ff5722'  // Deep orange
            };
        } else {
            // Light theme - softer, more muted colors that work well on light backgrounds
            return {
                2: 'var(--vscode-button-background)',
                4: 'var(--vscode-button-hoverBackground)',
                8: '#ff8f00', // Darker orange for better contrast
                16: '#0277bd', // Darker blue
                32: '#d32f2f', // Darker red
                64: '#f57c00', // Amber
                128: '#fbc02d', // Darker yellow
                256: '#c62828', // Dark red
                512: '#7b1fa2', // Dark purple
                1024: '#1976d2', // Dark blue
                2048: '#388e3c', // Dark green
                // Extended values
                4096: '#c2185b', // Dark pink
                8192: '#d84315'  // Dark deep orange
            };
        }
    }

    private setupThemeChangeListener(): void {
        try {
            // Listen for theme changes and automatically update the webview
            if (vscode.window && vscode.window.onDidChangeActiveColorTheme) {
                vscode.window.onDidChangeActiveColorTheme((theme) => {
                    try {
                        // Send updated theme data to webview
                        this.sendThemeData();
                    } catch (error) {
                        console.error('Error handling theme change:', error);
                    }
                });
            }
        } catch (error) {
            console.error('Error setting up theme change listener:', error);
        }
    }

    private _getErrorHtml(errorMessage: string): string {
        const html = [
            '<!DOCTYPE html>',
            '<html lang="en">',
            '<head>',
            '    <meta charset="UTF-8">',
            '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
            '    <title>2048 Game - Error</title>',
            '    <style>',
            '        body {',
            '            font-family: var(--vscode-font-family);',
            '            background-color: var(--vscode-editor-background);',
            '            color: var(--vscode-editor-foreground);',
            '            margin: 0;',
            '            padding: 20px;',
            '            text-align: center;',
            '        }',
            '        .error-container {',
            '            background-color: var(--vscode-inputValidation-errorBackground);',
            '            border: 1px solid var(--vscode-inputValidation-errorBorder);',
            '            border-radius: 5px;',
            '            padding: 20px;',
            '            margin: 20px 0;',
            '        }',
            '        .retry-btn {',
            '            background-color: var(--vscode-button-background);',
            '            color: var(--vscode-button-foreground);',
            '            border: none;',
            '            padding: 8px 16px;',
            '            border-radius: 3px;',
            '            cursor: pointer;',
            '            margin-top: 10px;',
            '        }',
            '    </style>',
            '</head>',
            '<body>',
            '    <div class="error-container">',
            '        <h3>2048 Game Error</h3>',
            '        <p>' + errorMessage + '</p>',
            '        <button class="retry-btn" onclick="location.reload()">Retry</button>',
            '    </div>',
            '</body>',
            '</html>'
        ];
        return html.join('\n');
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>2048 Game</title>
            <style>
                /* CSS Custom Properties for theming */
                :root {
                    --tile-size: 60px;
                    --tile-gap: 8px;
                    --border-radius: 6px;
                    --animation-duration: 0.15s;
                    
                    /* Performance optimizations */
                    --gpu-acceleration: translateZ(0);
                    --will-change: transform, opacity;
                    
                    /* Theme-aware color properties */
                    --theme-background: var(--vscode-editor-background);
                    --theme-foreground: var(--vscode-editor-foreground);
                    --theme-accent: var(--vscode-focusBorder);
                    --theme-border: var(--vscode-input-border);
                    --theme-input-bg: var(--vscode-input-background);
                    --theme-button-bg: var(--vscode-button-background);
                    --theme-button-hover: var(--vscode-button-hoverBackground);
                    --theme-button-fg: var(--vscode-button-foreground);
                    
                    /* Tile color properties - will be updated dynamically */
                    --tile-color-2: var(--vscode-button-background);
                    --tile-color-4: var(--vscode-button-hoverBackground);
                    --tile-color-8: var(--vscode-inputValidation-warningBackground);
                    --tile-color-16: var(--vscode-inputValidation-infoBackground);
                    --tile-color-32: var(--vscode-inputValidation-errorBackground);
                    --tile-color-64: var(--vscode-charts-orange);
                    --tile-color-128: var(--vscode-charts-yellow);
                    --tile-color-256: var(--vscode-charts-red);
                    --tile-color-512: var(--vscode-charts-purple);
                    --tile-color-1024: var(--vscode-charts-blue);
                    --tile-color-2048: var(--vscode-charts-green);
                    --tile-color-4096: var(--vscode-charts-foreground);
                    --tile-color-8192: var(--vscode-errorForeground);
                    
                    /* Text color properties for tiles */
                    --tile-text-light: var(--vscode-button-foreground);
                    --tile-text-dark: var(--vscode-editor-background);
                    
                    /* High contrast mode adjustments */
                    --hc-border-width: 1px;
                    --hc-focus-width: 2px;
                    
                    /* Contrast enhancement properties */
                    --tile-border-width: 1px;
                    --tile-shadow-blur: 10px;
                    --tile-shadow-spread: 0px;
                    --tile-text-shadow: none;
                }

                * {
                    box-sizing: border-box;
                }

                body {
                    font-family: var(--vscode-font-family);
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    margin: 0;
                    padding: 16px;
                    overflow-x: hidden;
                    user-select: none;
                }
                
                .game-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 16px;
                    max-width: 100%;
                    min-height: 100vh;
                }

                /* Header section with score and controls */
                .game-header {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                    width: 100%;
                }

                .score-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 16px;
                    background-color: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: var(--border-radius);
                    min-width: 120px;
                }

                .score-label {
                    font-size: 12px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: var(--vscode-descriptionForeground);
                }

                .score-value {
                    font-size: 24px;
                    font-weight: bold;
                    color: var(--vscode-editor-foreground);
                }

                /* Game buttons */
                .game-buttons {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                    justify-content: center;
                }

                .game-btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    border-radius: var(--border-radius);
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 600;
                    transition: background-color 0.2s ease;
                    min-width: 80px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                }
                
                .game-btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }

                .game-btn:active {
                    transform: translateY(1px);
                }

                .game-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .share-btn {
                    background-color: var(--vscode-button-secondaryBackground, var(--vscode-input-background));
                    color: var(--vscode-button-secondaryForeground, var(--vscode-input-foreground));
                    border: 1px solid var(--vscode-input-border);
                }

                .share-btn:hover:not(:disabled) {
                    background-color: var(--vscode-input-background);
                    border-color: var(--vscode-focusBorder);
                }

                /* Game board container */
                .game-board-container {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                }
                
                .game-board {
                    display: grid;
                    grid-template-columns: repeat(4, var(--tile-size));
                    grid-template-rows: repeat(4, var(--tile-size));
                    gap: var(--tile-gap);
                    background-color: var(--vscode-input-background);
                    border: 2px solid var(--vscode-input-border);
                    padding: var(--tile-gap);
                    border-radius: var(--border-radius);
                    position: relative;
                }

                /* Responsive design for smaller screens */
                @media (max-width: 300px) {
                    :root {
                        --tile-size: 50px;
                        --tile-gap: 6px;
                    }
                    
                    body {
                        padding: 12px;
                    }
                    
                    .score-value {
                        font-size: 20px;
                    }
                }
                
                /* Base tile styling */
                .tile {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background-color: var(--vscode-input-background);
                    border: var(--tile-border-width, 1px) solid var(--vscode-input-border);
                    border-radius: calc(var(--border-radius) - 2px);
                    font-weight: bold;
                    font-size: 18px;
                    transition: all var(--animation-duration) ease-in-out;
                    position: relative;
                    overflow: hidden;
                    text-shadow: var(--tile-text-shadow, none);
                    
                    /* Performance optimizations */
                    transform: var(--gpu-acceleration);
                    will-change: var(--will-change);
                    backface-visibility: hidden;
                    -webkit-font-smoothing: antialiased;
                }

                .tile.empty {
                    background-color: var(--vscode-input-background);
                    border-color: var(--vscode-input-border);
                    opacity: 0.6;
                }

                /* Tile value-specific styling using CSS custom properties */
                .tile.tile-2 {
                    background-color: var(--tile-color-2);
                    color: var(--tile-text-light);
                    border-color: var(--tile-color-2);
                }

                .tile.tile-4 {
                    background-color: var(--tile-color-4);
                    color: var(--tile-text-light);
                    border-color: var(--tile-color-4);
                }

                .tile.tile-8 {
                    background-color: var(--tile-color-8);
                    color: var(--tile-text-light);
                    border-color: var(--tile-color-8);
                }

                .tile.tile-16 {
                    background-color: var(--tile-color-16);
                    color: var(--tile-text-light);
                    border-color: var(--tile-color-16);
                }

                .tile.tile-32 {
                    background-color: var(--tile-color-32);
                    color: var(--tile-text-light);
                    border-color: var(--tile-color-32);
                }

                .tile.tile-64 {
                    background-color: var(--tile-color-64);
                    color: var(--tile-text-dark);
                    border-color: var(--tile-color-64);
                    font-size: 16px;
                }

                .tile.tile-128 {
                    background-color: var(--tile-color-128);
                    color: var(--tile-text-dark);
                    border-color: var(--tile-color-128);
                    font-size: 15px;
                }

                .tile.tile-256 {
                    background-color: var(--tile-color-256);
                    color: var(--tile-text-dark);
                    border-color: var(--tile-color-256);
                    font-size: 15px;
                }

                .tile.tile-512 {
                    background-color: var(--tile-color-512);
                    color: var(--tile-text-dark);
                    border-color: var(--tile-color-512);
                    font-size: 14px;
                }

                .tile.tile-1024 {
                    background-color: var(--tile-color-1024);
                    color: var(--tile-text-dark);
                    border-color: var(--tile-color-1024);
                    font-size: 13px;
                }

                .tile.tile-2048 {
                    background-color: var(--tile-color-2048);
                    color: var(--tile-text-dark);
                    border-color: var(--tile-color-2048);
                    font-size: 13px;
                    box-shadow: 0 0 var(--tile-shadow-blur) var(--tile-shadow-spread) var(--tile-color-2048);
                }

                /* Extended tile values for higher scores */
                .tile.tile-4096 {
                    background-color: var(--tile-color-4096, var(--vscode-charts-foreground));
                    color: var(--tile-text-dark);
                    border-color: var(--tile-color-4096, var(--vscode-charts-foreground));
                    font-size: 12px;
                    box-shadow: 0 0 calc(var(--tile-shadow-blur) + 2px) var(--tile-shadow-spread) var(--tile-color-4096, var(--vscode-charts-foreground));
                }

                .tile.tile-8192 {
                    background-color: var(--tile-color-8192, var(--vscode-errorForeground));
                    color: var(--tile-text-dark);
                    border-color: var(--tile-color-8192, var(--vscode-errorForeground));
                    font-size: 11px;
                    box-shadow: 0 0 calc(var(--tile-shadow-blur) + 5px) var(--tile-shadow-spread) var(--tile-color-8192, var(--vscode-errorForeground));
                }

                /* Generic styling for any tile value above 8192 */
                .tile[class*="tile-"]:not(.tile-2):not(.tile-4):not(.tile-8):not(.tile-16):not(.tile-32):not(.tile-64):not(.tile-128):not(.tile-256):not(.tile-512):not(.tile-1024):not(.tile-2048):not(.tile-4096):not(.tile-8192) {
                    background-color: var(--vscode-errorForeground);
                    color: var(--tile-text-dark);
                    border-color: var(--vscode-errorForeground);
                    font-size: 10px;
                    box-shadow: 0 0 20px var(--vscode-errorForeground);
                    font-weight: 900;
                }

                /* Animation classes for new tiles */
                .tile.new-tile {
                    animation: tileAppear var(--animation-duration) ease-in-out;
                }

                @keyframes tileAppear {
                    0% {
                        transform: scale(0);
                        opacity: 0;
                    }
                    100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }

                /* Animation classes for merged tiles */
                .tile.merged-tile {
                    animation: tileMerge var(--animation-duration) ease-in-out;
                }

                @keyframes tileMerge {
                    0% {
                        transform: scale(1);
                    }
                    50% {
                        transform: scale(1.1);
                    }
                    100% {
                        transform: scale(1);
                    }
                }

                /* Game status display */
                .game-status {
                    font-size: 16px;
                    font-weight: 600;
                    text-align: center;
                    padding: 8px 16px;
                    border-radius: var(--border-radius);
                    min-height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                }

                .game-status.playing {
                    color: var(--vscode-editor-foreground);
                    background-color: transparent;
                }

                .game-status.won {
                    color: var(--vscode-charts-green);
                    background-color: var(--vscode-inputValidation-infoBackground);
                    border: 1px solid var(--vscode-charts-green);
                }

                .game-status.lost {
                    color: var(--vscode-inputValidation-errorForeground);
                    background-color: var(--vscode-inputValidation-errorBackground);
                    border: 1px solid var(--vscode-inputValidation-errorBorder);
                }

                /* Instructions */
                .game-instructions {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    text-align: center;
                    line-height: 1.4;
                    max-width: 280px;
                }

                /* Focus indicator for accessibility */
                .game-board:focus {
                    outline: 2px solid var(--vscode-focusBorder);
                    outline-offset: 2px;
                }

                .game-board.focused {
                    box-shadow: 0 0 0 2px var(--vscode-focusBorder);
                }

                /* Keyboard input feedback animations */
                .game-board.move-up {
                    transform: translateY(-2px);
                    transition: transform 0.15s ease-out;
                }

                .game-board.move-down {
                    transform: translateY(2px);
                    transition: transform 0.15s ease-out;
                }

                .game-board.move-left {
                    transform: translateX(-2px);
                    transition: transform 0.15s ease-out;
                }

                .game-board.move-right {
                    transform: translateX(2px);
                    transition: transform 0.15s ease-out;
                }

                /* Game inactive state */
                .game-board.game-inactive {
                    opacity: 0.6;
                    pointer-events: none;
                }

                .game-board.game-inactive .tile {
                    opacity: 0.5;
                }

                /* Keyboard hints */
                .keyboard-hints {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    text-align: center;
                    margin-top: 8px;
                    line-height: 1.3;
                }

                .keyboard-hints .key {
                    background-color: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 3px;
                    padding: 2px 4px;
                    font-family: monospace;
                    font-size: 10px;
                    margin: 0 1px;
                }

                /* High contrast theme support */
                @media (prefers-contrast: high) {
                    .tile {
                        border-width: 2px;
                    }
                    
                    .game-board {
                        border-width: 3px;
                    }

                    .game-board:focus {
                        outline-width: 3px;
                    }
                }

                /* High contrast mode class-based styling */
                .high-contrast .tile {
                    border-width: var(--hc-border-width);
                    border-style: solid;
                }

                .high-contrast .game-board {
                    border-width: calc(var(--hc-border-width) + 1px);
                }

                .high-contrast .game-board:focus,
                .high-contrast .game-board.focused {
                    outline-width: var(--hc-focus-width);
                    box-shadow: 0 0 0 var(--hc-focus-width) var(--vscode-focusBorder);
                }

                .high-contrast .game-btn {
                    border: var(--hc-border-width) solid var(--vscode-button-foreground);
                }

                .high-contrast .share-btn {
                    border: var(--hc-border-width) solid var(--vscode-input-foreground);
                }

                .high-contrast .score-container {
                    border-width: var(--hc-border-width);
                }

                /* Dark theme specific adjustments */
                .dark-theme .tile.tile-2048 {
                    box-shadow: 0 0 calc(var(--tile-shadow-blur) + 5px) var(--tile-shadow-spread) var(--tile-color-2048);
                }

                .dark-theme .tile.tile-4096,
                .dark-theme .tile.tile-8192 {
                    box-shadow: 0 0 calc(var(--tile-shadow-blur) + 10px) var(--tile-shadow-spread) currentColor;
                }

                /* Light theme specific adjustments */
                .light-theme .tile.tile-2048 {
                    box-shadow: 0 0 var(--tile-shadow-blur) var(--tile-shadow-spread) var(--tile-color-2048);
                }

                .light-theme .tile.tile-4096,
                .light-theme .tile.tile-8192 {
                    box-shadow: 0 0 calc(var(--tile-shadow-blur) - 2px) var(--tile-shadow-spread) currentColor;
                }

                /* Improved color scaling for better visual hierarchy */
                .tile[class*="tile-"] {
                    /* Ensure all tiles have consistent border styling */
                    border-width: var(--tile-border-width);
                    border-style: solid;
                }

                /* Progressive font size scaling for better readability */
                .tile.tile-16384 { font-size: 10px; }
                .tile.tile-32768 { font-size: 9px; }
                .tile.tile-65536 { font-size: 8px; }
            </style>
        </head>
        <body>
            <div class="game-container">
                <div class="game-header">
                    <div class="score-container">
                        <div class="score-label">Score</div>
                        <div class="score-value" id="score">0</div>
                    </div>
                    <div class="game-buttons">
                        <button class="game-btn" onclick="requestNewGame()" title="Start a new game">
                            🎮 New Game
                        </button>
                        <button class="game-btn share-btn" id="shareBtn" onclick="shareScore()" title="Share your score">
                            📸 Share
                        </button>
                    </div>
                </div>

                <div class="game-board-container">
                    <div class="game-board" id="gameBoard" tabindex="0" role="grid" aria-label="2048 game board" onclick="this.focus()"
                        <!-- Game tiles will be generated here -->
                    </div>
                    <div class="game-status playing" id="gameStatus" role="status" aria-live="polite">
                        Press arrow keys to play!
                    </div>
                </div>

                <div class="game-instructions">
                    Use arrow keys to move tiles. When two tiles with the same number touch, they merge into one!
                </div>

                <div class="keyboard-hints">
                    <div>Move: <span class="key">↑</span> <span class="key">↓</span> <span class="key">←</span> <span class="key">→</span> or <span class="key">WASD</span></div>
                    <div>New Game: <span class="key">Space</span> <span class="key">R</span> <span class="key">N</span></div>
                </div>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();

                /**
                 * ErrorBoundary class for comprehensive error handling and recovery
                 * Provides error boundaries, automatic recovery, and user-facing error display
                 */
                class ErrorBoundary {
                    constructor() {
                        this.errorCount = 0;
                        this.maxErrors = 5;
                        this.errorResetTime = 30000; // 30 seconds
                        this.lastErrorTime = 0;
                        this.criticalErrors = new Set(['GAME_ENGINE_FAILURE', 'RENDERER_FAILURE', 'COMMUNICATION_FAILURE']);
                        this.setupGlobalErrorHandlers();
                    }

                    /**
                     * Set up global error handlers for unhandled errors
                     */
                    setupGlobalErrorHandlers() {
                        // Handle JavaScript errors
                        window.addEventListener('error', (event) => {
                            this.handleError(event.error || new Error(event.message), 'JAVASCRIPT_ERROR', {
                                filename: event.filename,
                                lineno: event.lineno,
                                colno: event.colno
                            });
                        });

                        // Handle unhandled promise rejections
                        window.addEventListener('unhandledrejection', (event) => {
                            this.handleError(event.reason, 'UNHANDLED_PROMISE_REJECTION', {
                                promise: event.promise
                            });
                        });
                    }

                    /**
                     * Handle errors with automatic recovery attempts
                     * @param {Error} error - The error that occurred
                     * @param {string} errorCode - Error code for categorization
                     * @param {Object} context - Additional context about the error
                     */
                    handleError(error, errorCode = 'UNKNOWN_ERROR', context = {}) {
                        try {
                            const now = Date.now();
                            
                            // Reset error count if enough time has passed
                            if (now - this.lastErrorTime > this.errorResetTime) {
                                this.errorCount = 0;
                            }
                            
                            this.errorCount++;
                            this.lastErrorTime = now;

                            // Log error details
                            console.error('Error caught by ErrorBoundary:', {
                                error: error.message,
                                stack: error.stack,
                                code: errorCode,
                                context: context,
                                count: this.errorCount
                            });

                            // Report error to extension
                            this.reportErrorToExtension(error, errorCode, context);

                            // Determine if this is a critical error
                            const isCritical = this.criticalErrors.has(errorCode) || this.errorCount >= this.maxErrors;

                            if (isCritical) {
                                this.handleCriticalError(error, errorCode, context);
                            } else {
                                this.handleRecoverableError(error, errorCode, context);
                            }
                        } catch (handlerError) {
                            console.error('Error in error handler:', handlerError);
                            this.showFallbackError('Multiple errors occurred. Please reload the extension.');
                        }
                    }

                    /**
                     * Handle recoverable errors with automatic recovery
                     * @param {Error} error - The error that occurred
                     * @param {string} errorCode - Error code
                     * @param {Object} context - Error context
                     */
                    handleRecoverableError(error, errorCode, context) {
                        // Show user-friendly error message
                        const userMessage = this.getUserFriendlyMessage(errorCode, error.message);
                        this.showError(userMessage, false);

                        // Attempt automatic recovery based on error type
                        setTimeout(() => {
                            this.attemptRecovery(errorCode, context);
                        }, 1000);
                    }

                    /**
                     * Handle critical errors that require user intervention
                     * @param {Error} error - The error that occurred
                     * @param {string} errorCode - Error code
                     * @param {Object} context - Error context
                     */
                    handleCriticalError(error, errorCode, context) {
                        const userMessage = this.getUserFriendlyMessage(errorCode, error.message);
                        this.showError(userMessage, true);

                        // Disable game functionality
                        if (window.keyboardHandler) {
                            window.keyboardHandler.setGameActive(false);
                        }

                        // Show recovery options
                        this.showRecoveryOptions();
                    }

                    /**
                     * Attempt automatic recovery based on error type
                     * @param {string} errorCode - Error code
                     * @param {Object} context - Error context
                     */
                    attemptRecovery(errorCode, context) {
                        try {
                            switch (errorCode) {
                                case 'RENDER_ERROR':
                                    this.recoverRenderer();
                                    break;
                                case 'COMMUNICATION_ERROR':
                                    this.recoverCommunication();
                                    break;
                                case 'THEME_ERROR':
                                    this.recoverTheme();
                                    break;
                                case 'INPUT_ERROR':
                                    this.recoverInput();
                                    break;
                                default:
                                    this.recoverGeneral();
                            }
                        } catch (recoveryError) {
                            console.error('Recovery attempt failed:', recoveryError);
                            this.handleCriticalError(recoveryError, 'RECOVERY_FAILURE', { originalError: errorCode });
                        }
                    }

                    /**
                     * Recover renderer functionality
                     */
                    recoverRenderer() {
                        console.log('Attempting renderer recovery...');
                        if (window.uiRenderer) {
                            window.uiRenderer.clearAnimations();
                            window.uiRenderer.initializeBoard();
                            this.showError('Renderer recovered. Game reinitialized.', false, 3000);
                        }
                    }

                    /**
                     * Recover communication with extension
                     */
                    recoverCommunication() {
                        console.log('Attempting communication recovery...');
                        try {
                            // Test communication
                            vscode.postMessage({ type: 'requestTheme' });
                            this.showError('Communication recovered.', false, 3000);
                        } catch (error) {
                            throw new Error('Communication recovery failed');
                        }
                    }

                    /**
                     * Recover theme functionality
                     */
                    recoverTheme() {
                        console.log('Attempting theme recovery...');
                        // Apply fallback theme
                        const fallbackTheme = {
                            isDark: true,
                            isHighContrast: false,
                            backgroundColor: '#1e1e1e',
                            foregroundColor: '#cccccc',
                            tileColors: {
                                2: '#3c3c3c',
                                4: '#4a4a4a',
                                8: '#ff9500',
                                16: '#007acc'
                            }
                        };
                        
                        if (window.uiRenderer) {
                            window.uiRenderer.updateTheme(fallbackTheme);
                            this.showError('Theme recovered with fallback colors.', false, 3000);
                        }
                    }

                    /**
                     * Recover input functionality
                     */
                    recoverInput() {
                        console.log('Attempting input recovery...');
                        const gameBoard = document.getElementById('gameBoard');
                        if (gameBoard && window.keyboardHandler) {
                            window.keyboardHandler.focusGameBoard();
                            window.keyboardHandler.setGameActive(true);
                            this.showError('Input recovered. Game is ready.', false, 3000);
                        }
                    }

                    /**
                     * General recovery attempt
                     */
                    recoverGeneral() {
                        console.log('Attempting general recovery...');
                        // Clear any stuck states
                        if (window.uiRenderer) {
                            window.uiRenderer.clearAnimations();
                        }
                        
                        // Re-request theme and game state
                        try {
                            vscode.postMessage({ type: 'requestTheme' });
                            vscode.postMessage({ type: 'requestSavedGame' });
                            this.showError('System recovered. Refreshing game state.', false, 3000);
                        } catch (error) {
                            throw new Error('General recovery failed');
                        }
                    }

                    /**
                     * Report error to extension for logging
                     * @param {Error} error - The error
                     * @param {string} errorCode - Error code
                     * @param {Object} context - Error context
                     */
                    reportErrorToExtension(error, errorCode, context) {
                        try {
                            vscode.postMessage({
                                type: 'error',
                                error: {
                                    message: error.message,
                                    stack: error.stack,
                                    code: errorCode,
                                    context: {
                                        ...context,
                                        type: this.criticalErrors.has(errorCode) ? 'critical' : 'recoverable',
                                        timestamp: Date.now(),
                                        userAgent: navigator.userAgent,
                                        url: window.location.href
                                    }
                                }
                            });
                        } catch (reportError) {
                            console.error('Failed to report error to extension:', reportError);
                        }
                    }

                    /**
                     * Get user-friendly error message
                     * @param {string} errorCode - Error code
                     * @param {string} originalMessage - Original error message
                     * @returns {string} User-friendly message
                     */
                    getUserFriendlyMessage(errorCode, originalMessage) {
                        const messages = {
                            'JAVASCRIPT_ERROR': 'A script error occurred. The game will attempt to recover.',
                            'UNHANDLED_PROMISE_REJECTION': 'An operation failed unexpectedly. Attempting recovery.',
                            'RENDER_ERROR': 'Display error occurred. Refreshing the game board.',
                            'COMMUNICATION_ERROR': 'Communication with VSCode failed. Retrying connection.',
                            'THEME_ERROR': 'Theme loading failed. Using fallback colors.',
                            'INPUT_ERROR': 'Keyboard input error. Resetting input handler.',
                            'GAME_ENGINE_FAILURE': 'Game engine error. Please restart the game.',
                            'RENDERER_FAILURE': 'Display system failure. Please reload the extension.',
                            'COMMUNICATION_FAILURE': 'Cannot communicate with VSCode. Please reload the extension.',
                            'RECOVERY_FAILURE': 'Recovery failed. Please reload the extension.'
                        };

                        return messages[errorCode] || \`An error occurred: \${originalMessage}\`;
                    }

                    /**
                     * Show error message to user
                     * @param {string} message - Error message
                     * @param {boolean} isCritical - Whether this is a critical error
                     * @param {number} duration - How long to show the message (0 = permanent)
                     */
                    showError(message, isCritical = false, duration = 0) {
                        const statusElement = document.getElementById('gameStatus');
                        if (statusElement) {
                            statusElement.textContent = message;
                            statusElement.className = \`game-status \${isCritical ? 'lost' : 'playing'}\`;
                            statusElement.setAttribute('aria-live', 'assertive');

                            if (duration > 0) {
                                setTimeout(() => {
                                    if (statusElement.textContent === message) {
                                        statusElement.textContent = 'Press arrow keys to play!';
                                        statusElement.className = 'game-status playing';
                                    }
                                }, duration);
                            }
                        }
                    }

                    /**
                     * Show fallback error when error handler itself fails
                     * @param {string} message - Fallback message
                     */
                    showFallbackError(message) {
                        try {
                            const statusElement = document.getElementById('gameStatus');
                            if (statusElement) {
                                statusElement.textContent = message;
                                statusElement.className = 'game-status lost';
                            }
                        } catch (error) {
                            // Last resort - use alert
                            alert(message);
                        }
                    }

                    /**
                     * Show recovery options to user
                     */
                    showRecoveryOptions() {
                        const statusElement = document.getElementById('gameStatus');
                        if (statusElement) {
                            statusElement.innerHTML = \`
                                Critical error occurred. 
                                <br>Press R to restart game or reload the extension.
                            \`;
                            statusElement.className = 'game-status lost';
                        }
                    }

                    /**
                     * Wrap a function with error boundary
                     * @param {Function} fn - Function to wrap
                     * @param {string} errorCode - Error code to use if function fails
                     * @param {Object} context - Additional context
                     * @returns {Function} Wrapped function
                     */
                    wrap(fn, errorCode = 'WRAPPED_FUNCTION_ERROR', context = {}) {
                        return (...args) => {
                            try {
                                return fn.apply(this, args);
                            } catch (error) {
                                this.handleError(error, errorCode, { ...context, args });
                                return null;
                            }
                        };
                    }

                    /**
                     * Reset error state (useful for testing or manual recovery)
                     */
                    reset() {
                        this.errorCount = 0;
                        this.lastErrorTime = 0;
                        console.log('ErrorBoundary reset');
                    }
                }

                // Create global error boundary
                const errorBoundary = new ErrorBoundary();

                /**
                 * UIRenderer class for dynamic game display updates
                 * Handles rendering board state changes, score updates, and animations
                 * Enhanced with comprehensive error handling
                 */
                class UIRenderer {
                    constructor() {
                        try {
                            this.boardElement = document.getElementById('gameBoard');
                            this.scoreElement = document.getElementById('score');
                            this.statusElement = document.getElementById('gameStatus');
                            this.previousBoard = null;
                            this.animationQueue = [];
                            this.isAnimating = false;
                            this.renderAttempts = 0;
                            this.maxRenderAttempts = 3;
                            
                            // Performance monitoring
                            this.performanceMetrics = {
                                renderCount: 0,
                                totalRenderTime: 0,
                                averageRenderTime: 0,
                                lastRenderTime: 0
                            };
                            
                            // Rendering optimizations
                            this.requestAnimationFrameId = null;
                            this.pendingUpdates = new Map();
                            this.batchUpdateTimeout = null;

                            // Validate essential elements
                            if (!this.boardElement) {
                                throw new Error('Game board element not found');
                            }
                            if (!this.scoreElement) {
                                throw new Error('Score element not found');
                            }
                            if (!this.statusElement) {
                                throw new Error('Status element not found');
                            }
                        } catch (error) {
                            errorBoundary.handleError(error, 'RENDERER_INITIALIZATION_ERROR');
                            throw error;
                        }
                    }

                    /**
                     * Initialize the game board with empty tiles
                     */
                    initializeBoard() {
                        return errorBoundary.wrap(() => {
                            if (!this.boardElement) {
                                throw new Error('Game board element not found');
                            }
                            
                            // Clear existing content safely
                            while (this.boardElement.firstChild) {
                                this.boardElement.removeChild(this.boardElement.firstChild);
                            }
                            
                            // Create 16 tiles (4x4 grid) with error checking
                            const fragment = document.createDocumentFragment();
                            for (let row = 0; row < 4; row++) {
                                for (let col = 0; col < 4; col++) {
                                    const tile = document.createElement('div');
                                    tile.className = 'tile empty';
                                    tile.id = \`tile-\` + row + \`-\` + col;
                                    tile.setAttribute('role', 'gridcell');
                                    tile.setAttribute('aria-label', 'Empty cell');
                                    
                                    // Validate tile creation
                                    if (!tile.id || !tile.className) {
                                        throw new Error('Failed to create tile at ' + row + ',' + col);
                                    }
                                    
                                    fragment.appendChild(tile);
                                }
                            }
                            
                            this.boardElement.appendChild(fragment);

                            // Reset previous board state
                            this.previousBoard = Array(4).fill().map(() => Array(4).fill(0));
                            this.renderAttempts = 0;
                            
                            // Verify board was created correctly
                            const tiles = this.boardElement.querySelectorAll('.tile');
                            if (tiles.length !== 16) {
                                throw new Error('Expected 16 tiles, found ' + tiles.length);
                            }
                            
                            console.log('Board initialized successfully');
                        }, 'BOARD_INITIALIZATION_ERROR', { method: 'initializeBoard' })();
                    }

                    /**
                     * Render the complete board state with animations
                     * @param {number[][]} board - 4x4 board array
                     * @param {Object} options - Rendering options
                     */
                    renderBoard(board, options = {}) {
                        return errorBoundary.wrap(() => {
                            const renderStartTime = performance.now();
                            
                            // Validate board data
                            if (!board || !Array.isArray(board) || board.length !== 4) {
                                throw new Error(\`Invalid board data: expected 4x4 array, got \${board ? board.length : 'null'}\`);
                            }
                            
                            // Validate each row
                            for (let i = 0; i < 4; i++) {
                                if (!Array.isArray(board[i]) || board[i].length !== 4) {
                                    throw new Error(\`Invalid board row \${i}: expected array of length 4\`);
                                }
                                
                                // Validate each cell value
                                for (let j = 0; j < 4; j++) {
                                    const value = board[i][j];
                                    if (typeof value !== 'number' || value < 0 || !Number.isInteger(value)) {
                                        throw new Error(\`Invalid cell value at [\${i}][\${j}]: \${value}\`);
                                    }
                                }
                            }

                            this.renderAttempts++;
                            if (this.renderAttempts > this.maxRenderAttempts) {
                                throw new Error('Maximum render attempts exceeded');
                            }

                            // Detect changes and animations needed
                            const changes = this.detectBoardChanges(board);
                            
                            // Apply changes with appropriate animations
                            this.applyBoardChanges(changes);
                            
                            // Update previous board state
                            this.previousBoard = board.map(row => [...row]);
                            
                            // Reset render attempts on successful render
                            this.renderAttempts = 0;
                            
                            // Update performance metrics
                            const renderEndTime = performance.now();
                            const renderTime = renderEndTime - renderStartTime;
                            this.updatePerformanceMetrics(renderTime);
                            
                        }, 'RENDER_ERROR', { method: 'renderBoard', boardSize: board ? board.length : 0 })();
                    }

                    /**
                     * Detect changes between previous and current board state
                     * @param {number[][]} newBoard - New board state
                     * @returns {Object} Changes object with new, moved, and merged tiles
                     */
                    detectBoardChanges(newBoard) {
                        const changes = {
                            newTiles: [],
                            changedTiles: [],
                            mergedTiles: []
                        };

                        if (!this.previousBoard) {
                            // First render - all non-zero tiles are new
                            for (let row = 0; row < 4; row++) {
                                for (let col = 0; col < 4; col++) {
                                    if (newBoard[row][col] !== 0) {
                                        changes.newTiles.push({ row, col, value: newBoard[row][col] });
                                    }
                                }
                            }
                        } else {
                            // Compare with previous state
                            for (let row = 0; row < 4; row++) {
                                for (let col = 0; col < 4; col++) {
                                    const oldValue = this.previousBoard[row][col];
                                    const newValue = newBoard[row][col];

                                    if (oldValue !== newValue) {
                                        if (oldValue === 0 && newValue !== 0) {
                                            // New tile appeared
                                            changes.newTiles.push({ row, col, value: newValue });
                                        } else if (oldValue !== 0 && newValue !== 0 && oldValue !== newValue) {
                                            // Tile value changed (merged)
                                            changes.mergedTiles.push({ row, col, value: newValue, oldValue });
                                        } else {
                                            // Tile changed (moved or disappeared)
                                            changes.changedTiles.push({ row, col, value: newValue, oldValue });
                                        }
                                    }
                                }
                            }
                        }

                        return changes;
                    }

                    /**
                     * Apply board changes with appropriate animations
                     * @param {Object} changes - Changes to apply
                     */
                    applyBoardChanges(changes) {
                        // First, update all tiles without animations
                        for (let row = 0; row < 4; row++) {
                            for (let col = 0; col < 4; col++) {
                                const tile = document.getElementById(\`tile-\${row}-\${col}\`);
                                if (tile) {
                                    // Remove animation classes
                                    tile.classList.remove('new-tile', 'merged-tile');
                                }
                            }
                        }

                        // Apply changes with animations
                        setTimeout(() => {
                            // Handle new tiles
                            changes.newTiles.forEach(({ row, col, value }) => {
                                this.updateTile(row, col, value, true, false);
                            });

                            // Handle merged tiles
                            changes.mergedTiles.forEach(({ row, col, value }) => {
                                this.updateTile(row, col, value, false, true);
                            });

                            // Handle other changed tiles
                            changes.changedTiles.forEach(({ row, col, value }) => {
                                this.updateTile(row, col, value, false, false);
                            });
                        }, 10);
                    }

                    /**
                     * Update a single tile's display
                     * @param {number} row - Tile row
                     * @param {number} col - Tile column
                     * @param {number} value - Tile value
                     * @param {boolean} isNew - Whether this is a new tile
                     * @param {boolean} isMerged - Whether this tile was merged
                     */
                    updateTile(row, col, value, isNew = false, isMerged = false) {
                        return errorBoundary.wrap(() => {
                            // Validate parameters
                            if (typeof row !== 'number' || row < 0 || row >= 4) {
                                throw new Error(\`Invalid row: \${row}\`);
                            }
                            if (typeof col !== 'number' || col < 0 || col >= 4) {
                                throw new Error(\`Invalid col: \${col}\`);
                            }
                            if (typeof value !== 'number' || value < 0 || !Number.isInteger(value)) {
                                throw new Error(\`Invalid value: \${value}\`);
                            }

                            const tile = document.getElementById(\`tile-\${row}-\${col}\`);
                            if (!tile) {
                                throw new Error(\`Tile element not found: tile-\${row}-\${col}\`);
                            }

                            // Remove existing classes safely
                            tile.className = 'tile';
                            
                            if (value === 0) {
                                tile.className += ' empty';
                                tile.textContent = '';
                                tile.setAttribute('aria-label', 'Empty cell');
                            } else {
                                tile.className += \` tile-\${value}\`;
                                tile.textContent = value.toString();
                                tile.setAttribute('aria-label', \`Tile with value \${value}\`);
                                
                                if (isNew) {
                                    tile.classList.add('new-tile');
                                }
                                if (isMerged) {
                                    tile.classList.add('merged-tile');
                                }
                            }
                            
                            // Verify the update was successful
                            if (value === 0 && !tile.classList.contains('empty')) {
                                throw new Error('Failed to set empty tile class');
                            }
                            if (value > 0 && !tile.classList.contains(\`tile-\${value}\`)) {
                                throw new Error(\`Failed to set tile-\${value} class\`);
                            }
                        }, 'TILE_UPDATE_ERROR', { method: 'updateTile', row, col, value, isNew, isMerged })();
                    }

                    /**
                     * Render score with smooth animation
                     * @param {number} score - Current score
                     * @param {number} previousScore - Previous score for animation
                     */
                    renderScore(score, previousScore = null) {
                        if (!this.scoreElement) return;

                        try {
                            if (previousScore !== null && score > previousScore) {
                                // Animate score increase
                                this.animateScoreChange(previousScore, score);
                            } else {
                                // Direct update
                                this.scoreElement.textContent = score.toString();
                            }
                        } catch (error) {
                            console.error('Error rendering score:', error);
                            this.scoreElement.textContent = score.toString();
                        }
                    }

                    /**
                     * Animate score change from old to new value
                     * @param {number} fromScore - Starting score
                     * @param {number} toScore - Target score
                     */
                    animateScoreChange(fromScore, toScore) {
                        const duration = 300; // Animation duration in ms
                        const startTime = performance.now();
                        const scoreDiff = toScore - fromScore;

                        const animate = (currentTime) => {
                            const elapsed = currentTime - startTime;
                            const progress = Math.min(elapsed / duration, 1);
                            
                            // Easing function for smooth animation
                            const easeOut = 1 - Math.pow(1 - progress, 3);
                            const currentScore = Math.round(fromScore + (scoreDiff * easeOut));
                            
                            this.scoreElement.textContent = currentScore.toString();
                            
                            if (progress < 1) {
                                requestAnimationFrame(animate);
                            }
                        };

                        requestAnimationFrame(animate);
                    }

                    /**
                     * Render game status with appropriate styling
                     * @param {string} status - Status message
                     * @param {string} gameState - Game state ('playing', 'won', 'lost')
                     */
                    renderGameStatus(status, gameState = 'playing') {
                        if (!this.statusElement) return;

                        try {
                            this.statusElement.textContent = status;
                            this.statusElement.className = \`game-status \${gameState}\`;
                            
                            // Add accessibility announcement for status changes
                            this.statusElement.setAttribute('aria-live', 'polite');
                        } catch (error) {
                            console.error('Error rendering game status:', error);
                        }
                    }

                    /**
                     * Update theme colors dynamically
                     * @param {Object} themeData - Theme color data
                     */
                    updateTheme(themeData) {
                        try {
                            if (!themeData) return;

                            // Update CSS custom properties for theme colors
                            const root = document.documentElement;
                            
                            // Update basic theme properties
                            if (themeData.backgroundColor) {
                                root.style.setProperty('--theme-background', themeData.backgroundColor);
                            }
                            if (themeData.foregroundColor) {
                                root.style.setProperty('--theme-foreground', themeData.foregroundColor);
                            }
                            if (themeData.accentColor) {
                                root.style.setProperty('--theme-accent', themeData.accentColor);
                            }

                            // Update tile colors if provided
                            if (themeData.tileColors) {
                                Object.entries(themeData.tileColors).forEach(([value, color]) => {
                                    root.style.setProperty(\`--tile-color-\${value}\`, color);
                                });
                            }

                            // Handle high contrast mode
                            if (themeData.isHighContrast) {
                                root.style.setProperty('--hc-border-width', '2px');
                                root.style.setProperty('--hc-focus-width', '3px');
                                document.body.classList.add('high-contrast');
                            } else {
                                root.style.setProperty('--hc-border-width', '1px');
                                root.style.setProperty('--hc-focus-width', '2px');
                                document.body.classList.remove('high-contrast');
                            }

                            // Handle dark/light theme specific adjustments
                            if (themeData.isDark) {
                                document.body.classList.add('dark-theme');
                                document.body.classList.remove('light-theme');
                                // Dark theme: light text on dark tiles, dark text on bright tiles
                                root.style.setProperty('--tile-text-light', '#ffffff');
                                root.style.setProperty('--tile-text-dark', '#000000');
                            } else {
                                document.body.classList.add('light-theme');
                                document.body.classList.remove('dark-theme');
                                // Light theme: dark text on light tiles, white text on dark tiles
                                root.style.setProperty('--tile-text-light', '#333333');
                                root.style.setProperty('--tile-text-dark', '#ffffff');
                            }

                            // Apply accessibility improvements for contrast
                            this.applyContrastEnhancements(themeData);

                            console.log('Theme updated:', {
                                kind: themeData.kind,
                                isDark: themeData.isDark,
                                isHighContrast: themeData.isHighContrast
                            });
                        } catch (error) {
                            console.error('Error updating theme:', error);
                        }
                    }

                    /**
                     * Apply contrast enhancements for accessibility
                     * @param {Object} themeData - Theme data
                     */
                    applyContrastEnhancements(themeData) {
                        try {
                            const root = document.documentElement;
                            
                            // Enhance contrast for high contrast themes
                            if (themeData.isHighContrast) {
                                // Increase border widths and add stronger shadows
                                root.style.setProperty('--tile-border-width', '3px');
                                root.style.setProperty('--tile-shadow-blur', '0px');
                                root.style.setProperty('--tile-shadow-spread', '2px');
                                
                                // Ensure maximum contrast for text
                                root.style.setProperty('--tile-text-light', themeData.isDark ? '#ffffff' : '#000000');
                                root.style.setProperty('--tile-text-dark', themeData.isDark ? '#000000' : '#ffffff');
                            } else {
                                // Standard contrast settings
                                root.style.setProperty('--tile-border-width', '1px');
                                root.style.setProperty('--tile-shadow-blur', '10px');
                                root.style.setProperty('--tile-shadow-spread', '0px');
                            }

                            // Apply WCAG AA contrast ratio improvements
                            this.ensureContrastCompliance(themeData);
                        } catch (error) {
                            console.error('Error applying contrast enhancements:', error);
                        }
                    }

                    /**
                     * Ensure WCAG AA contrast compliance
                     * @param {Object} themeData - Theme data
                     */
                    ensureContrastCompliance(themeData) {
                        try {
                            const root = document.documentElement;
                            
                            // Define minimum contrast ratios for different tile values
                            const contrastMap = {
                                // Lower value tiles (2-32) need good contrast with light text
                                'low': themeData.isDark ? '#ffffff' : '#333333',
                                // Higher value tiles (64+) need good contrast with dark text  
                                'high': themeData.isDark ? '#000000' : '#ffffff'
                            };

                            // Apply contrast-optimized text colors
                            root.style.setProperty('--tile-text-light', contrastMap.low);
                            root.style.setProperty('--tile-text-dark', contrastMap.high);

                            // Add subtle text shadows for better readability on colored backgrounds
                            if (!themeData.isHighContrast) {
                                root.style.setProperty('--tile-text-shadow', 
                                    themeData.isDark ? '0 1px 2px rgba(0,0,0,0.5)' : '0 1px 2px rgba(255,255,255,0.5)');
                            } else {
                                root.style.setProperty('--tile-text-shadow', 'none');
                            }
                        } catch (error) {
                            console.error('Error ensuring contrast compliance:', error);
                        }
                    }

                    /**
                     * Show error message with enhanced error display
                     * @param {string} message - Error message
                     * @param {boolean} isCritical - Whether this is a critical error
                     * @param {number} duration - How long to show the message (0 = permanent)
                     */
                    showError(message, isCritical = false, duration = 0) {
                        try {
                            if (this.statusElement) {
                                this.statusElement.textContent = 'Error: ' + message;
                                this.statusElement.className = \`game-status \${isCritical ? 'lost' : 'playing'}\`;
                                this.statusElement.setAttribute('aria-live', 'assertive');

                                if (duration > 0) {
                                    setTimeout(() => {
                                        if (this.statusElement && this.statusElement.textContent.includes(message)) {
                                            this.statusElement.textContent = 'Press arrow keys to play!';
                                            this.statusElement.className = 'game-status playing';
                                        }
                                    }, duration);
                                }
                            }
                        } catch (error) {
                            console.error('Failed to show error message:', error);
                            // Fallback to console if UI fails
                            console.error('Original error:', message);
                        }
                    }

                    /**
                     * Clear all animations and reset state
                     */
                    clearAnimations() {
                        const tiles = this.boardElement?.querySelectorAll('.tile');
                        if (tiles) {
                            tiles.forEach(tile => {
                                tile.classList.remove('new-tile', 'merged-tile');
                            });
                        }
                        this.animationQueue = [];
                        this.isAnimating = false;
                    }

                    /**
                     * Update performance metrics for monitoring
                     * @param {number} renderTime - Time taken for last render in milliseconds
                     */
                    updatePerformanceMetrics(renderTime) {
                        this.performanceMetrics.renderCount++;
                        this.performanceMetrics.totalRenderTime += renderTime;
                        this.performanceMetrics.lastRenderTime = renderTime;
                        this.performanceMetrics.averageRenderTime = 
                            this.performanceMetrics.totalRenderTime / this.performanceMetrics.renderCount;

                        // Log performance warnings if rendering is slow
                        if (renderTime > 16.67) { // 60fps threshold
                            console.warn(\`Slow render detected: \${renderTime.toFixed(2)}ms (target: <16.67ms for 60fps)\`);
                        }

                        // Log performance summary every 100 renders
                        if (this.performanceMetrics.renderCount % 100 === 0) {
                            console.log('Rendering Performance Summary:', {
                                renders: this.performanceMetrics.renderCount,
                                averageTime: this.performanceMetrics.averageRenderTime.toFixed(2) + 'ms',
                                lastTime: this.performanceMetrics.lastRenderTime.toFixed(2) + 'ms',
                                totalTime: this.performanceMetrics.totalRenderTime.toFixed(2) + 'ms'
                            });
                        }
                    }

                    /**
                     * Batch DOM updates for better performance
                     * @param {Function} updateFunction - Function containing DOM updates
                     */
                    batchDOMUpdates(updateFunction) {
                        // Cancel any pending batch update
                        if (this.batchUpdateTimeout) {
                            clearTimeout(this.batchUpdateTimeout);
                        }

                        // Use requestAnimationFrame for optimal timing
                        if (this.requestAnimationFrameId) {
                            cancelAnimationFrame(this.requestAnimationFrameId);
                        }

                        this.requestAnimationFrameId = requestAnimationFrame(() => {
                            try {
                                updateFunction();
                            } catch (error) {
                                console.error('Error in batched DOM update:', error);
                            } finally {
                                this.requestAnimationFrameId = null;
                            }
                        });
                    }

                    /**
                     * Optimize tile updates by batching changes
                     * @param {Array} updates - Array of tile updates
                     */
                    batchTileUpdates(updates) {
                        this.batchDOMUpdates(() => {
                            // Group updates by type for optimal DOM manipulation
                            const newTiles = updates.filter(u => u.isNew);
                            const mergedTiles = updates.filter(u => u.isMerged);
                            const regularTiles = updates.filter(u => !u.isNew && !u.isMerged);

                            // Apply updates in order of visual priority
                            regularTiles.forEach(update => {
                                this.updateTile(update.row, update.col, update.value, false, false);
                            });

                            // Delay new and merged tiles for animation effect
                            setTimeout(() => {
                                newTiles.forEach(update => {
                                    this.updateTile(update.row, update.col, update.value, true, false);
                                });
                                
                                mergedTiles.forEach(update => {
                                    this.updateTile(update.row, update.col, update.value, false, true);
                                });
                            }, 10);
                        });
                    }

                    /**
                     * Get current performance metrics
                     * @returns {Object} Performance metrics object
                     */
                    getPerformanceMetrics() {
                        return { ...this.performanceMetrics };
                    }

                    /**
                     * Reset performance metrics
                     */
                    resetPerformanceMetrics() {
                        this.performanceMetrics = {
                            renderCount: 0,
                            totalRenderTime: 0,
                            averageRenderTime: 0,
                            lastRenderTime: 0
                        };
                    }

                    /**
                     * Cleanup resources for memory management
                     */
                    dispose() {
                        // Cancel any pending animations
                        if (this.requestAnimationFrameId) {
                            cancelAnimationFrame(this.requestAnimationFrameId);
                            this.requestAnimationFrameId = null;
                        }

                        if (this.batchUpdateTimeout) {
                            clearTimeout(this.batchUpdateTimeout);
                            this.batchUpdateTimeout = null;
                        }

                        // Clear references to DOM elements
                        this.boardElement = null;
                        this.scoreElement = null;
                        this.statusElement = null;

                        // Clear data structures
                        this.previousBoard = null;
                        this.animationQueue = [];
                        this.pendingUpdates.clear();

                        // Reset performance metrics
                        this.resetPerformanceMetrics();

                        console.log('UIRenderer disposed and cleaned up');
                    }
                }

                // Create global UI renderer instance
                window.uiRenderer = new UIRenderer();
                const uiRenderer = window.uiRenderer;
                
                // Legacy functions for backward compatibility
                function requestNewGame() {
                    try {
                        vscode.postMessage({ type: 'requestNewGame' });
                    } catch (error) {
                        console.error('Error requesting new game:', error);
                        uiRenderer.showError('Failed to start new game');
                    }
                }
                
                function requestTheme() {
                    try {
                        vscode.postMessage({ type: 'requestTheme' });
                    } catch (error) {
                        console.error('Error requesting theme:', error);
                    }
                }

                function shareScore() {
                    try {
                        // Get current game state from UI
                        const scoreElement = document.getElementById('score');
                        const statusElement = document.getElementById('gameStatus');
                        
                        if (!scoreElement) {
                            uiRenderer.showError('Unable to get current score');
                            return;
                        }

                        const score = parseInt(scoreElement.textContent || '0');
                        const statusText = statusElement?.textContent || '';
                        
                        // Determine game state from status text
                        let gameState = 'playing';
                        if (statusText.includes('won') || statusText.includes('🎉')) {
                            gameState = 'won';
                        } else if (statusText.includes('Over') || statusText.includes('😞')) {
                            gameState = 'lost';
                        }

                        // Get highest tile from board
                        let highestTile = 0;
                        const tiles = document.querySelectorAll('.tile:not(.empty)');
                        tiles.forEach(tile => {
                            const value = parseInt(tile.textContent || '0');
                            if (value > highestTile) {
                                highestTile = value;
                            }
                        });

                        // Capture screenshot of game board
                        const gameBoard = document.getElementById('gameBoard');
                        let imageData = null;
                        
                        if (gameBoard) {
                            try {
                                // Create a canvas to capture the game board
                                const canvas = document.createElement('canvas');
                                const ctx = canvas.getContext('2d');
                                
                                if (ctx) {
                                    const rect = gameBoard.getBoundingClientRect();
                                    canvas.width = rect.width * 2; // High DPI
                                    canvas.height = rect.height * 2;
                                    ctx.scale(2, 2);
                                    
                                    // Set background
                                    ctx.fillStyle = getComputedStyle(gameBoard).backgroundColor || '#faf8ef';
                                    ctx.fillRect(0, 0, rect.width, rect.height);
                                    
                                    // This is a simplified approach - in a real implementation,
                                    // we'd need to render the tiles manually or use html2canvas library
                                    imageData = canvas.toDataURL('image/png');
                                }
                            } catch (error) {
                                console.warn('Could not capture screenshot:', error);
                                // Continue without screenshot
                            }
                        }

                        // Send share request to extension
                        vscode.postMessage({
                            type: 'shareScore',
                            shareData: {
                                score: score,
                                highestTile: highestTile,
                                moveCount: 0, // We don't track this in UI currently
                                gameState: gameState,
                                imageData: imageData
                            }
                        });

                        // Provide user feedback
                        const shareBtn = document.getElementById('shareBtn');
                        if (shareBtn) {
                            const originalText = shareBtn.innerHTML;
                            shareBtn.innerHTML = '✨ Sharing...';
                            shareBtn.disabled = true;
                            
                            setTimeout(() => {
                                shareBtn.innerHTML = originalText;
                                shareBtn.disabled = false;
                            }, 2000);
                        }

                    } catch (error) {
                        console.error('Error sharing score:', error);
                        uiRenderer.showError('Failed to share score');
                    }
                }
                
                function showError(message) {
                    uiRenderer.showError(message);
                }
                
                function initializeBoard() {
                    uiRenderer.initializeBoard();
                }

                function updateTile(row, col, value, isNew = false, isMerged = false) {
                    uiRenderer.updateTile(row, col, value, isNew, isMerged);
                }

                function updateScore(score) {
                    uiRenderer.renderScore(score);
                }

                function updateGameStatus(status, gameState = 'playing') {
                    uiRenderer.renderGameStatus(status, gameState);
                }
                
                // Enhanced message handler with comprehensive error handling
                window.addEventListener('message', event => {
                    errorBoundary.wrap(() => {
                        const message = event.data;
                        
                        // Validate message structure
                        if (!message || typeof message !== 'object' || !message.type) {
                            throw new Error('Invalid message format received');
                        }
                        
                        console.log('Processing message:', message.type);
                        
                        switch (message.type) {
                            case 'newGame':
                                if (!window.uiRenderer) {
                                    console.error('UI renderer not available during newGame');
                                    return;
                                }
                                
                                if (message.state) {
                                    // Initialize with provided state
                                    window.uiRenderer.initializeBoard();
                                    window.uiRenderer.renderBoard(message.state.board);
                                    window.uiRenderer.renderScore(message.state.score || 0);
                                } else {
                                    // Initialize empty game
                                    window.uiRenderer.initializeBoard();
                                    window.uiRenderer.renderScore(0);
                                }
                                
                                window.uiRenderer.renderGameStatus('Press arrow keys to play!', 'playing');
                                
                                // Update keyboard handler state
                                if (window.keyboardHandler) {
                                    window.keyboardHandler.setGameActive(true);
                                } else {
                                    console.warn('Keyboard handler not available');
                                }
                                break;
                                
                            case 'gameStateUpdate':
                                if (!message.state) {
                                    throw new Error('Game state update missing state data');
                                }
                                
                                if (!window.uiRenderer) {
                                    console.error('UI renderer not available during gameStateUpdate');
                                    return;
                                }
                                
                                // Store previous score for animation
                                const currentScore = parseInt(window.uiRenderer.scoreElement?.textContent || '0');
                                
                                // Update board with animations
                                if (message.state.board) {
                                    window.uiRenderer.renderBoard(message.state.board);
                                }
                                
                                // Update score with animation
                                if (typeof message.state.score === 'number') {
                                    window.uiRenderer.renderScore(message.state.score, currentScore);
                                }
                                
                                // Update status and keyboard handler state
                                if (message.state.gameState) {
                                    let isGameActive = true;
                                    
                                    switch (message.state.gameState) {
                                        case 'won':
                                            uiRenderer.renderGameStatus('You won! 🎉 Press R for new game', 'won');
                                            isGameActive = false;
                                            break;
                                        case 'lost':
                                            uiRenderer.renderGameStatus('Game Over! 😞 Press R for new game', 'lost');
                                            isGameActive = false;
                                            break;
                                        case 'playing':
                                            uiRenderer.renderGameStatus('Press arrow keys to play!', 'playing');
                                            isGameActive = true;
                                            break;
                                        default:
                                            console.warn('Unknown game state:', message.state.gameState);
                                            uiRenderer.renderGameStatus('Press arrow keys to play!', 'playing');
                                            isGameActive = true;
                                    }
                                    
                                    // Update keyboard handler state
                                    if (keyboardHandler) {
                                        keyboardHandler.setGameActive(isGameActive);
                                    }

                                    // Update share button state
                                    const shareBtn = document.getElementById('shareBtn');
                                    if (shareBtn) {
                                        // Enable share button when there's a score to share
                                        const hasScore = message.state.score > 0;
                                        shareBtn.disabled = !hasScore;
                                        
                                        if (message.state.gameState === 'won') {
                                            shareBtn.innerHTML = '🎉 Share Victory!';
                                        } else if (message.state.gameState === 'lost') {
                                            shareBtn.innerHTML = '📸 Share Score';
                                        } else {
                                            shareBtn.innerHTML = '📸 Share';
                                        }
                                    }
                                }
                                break;
                                
                            case 'themeChanged':
                                if (!message.theme) {
                                    throw new Error('Theme change message missing theme data');
                                }
                                uiRenderer.updateTheme(message.theme);
                                break;
                                
                            case 'error':
                                const errorMessage = message.message || 'Unknown error occurred';
                                const isRecoverable = message.recoverable !== false;
                                
                                uiRenderer.showError(errorMessage, !isRecoverable);
                                
                                // Disable keyboard input on non-recoverable errors
                                if (!isRecoverable && keyboardHandler) {
                                    keyboardHandler.setGameActive(false);
                                }
                                break;
                                
                            default:
                                console.warn('Unknown message type:', message.type);
                                // Don't throw error for unknown message types to maintain compatibility
                        }
                    }, 'MESSAGE_HANDLING_ERROR', { messageType: event?.data?.type })();
                });
                
                /**
                 * KeyboardInputHandler class for managing keyboard input
                 * Handles arrow key presses, input validation, and focus management
                 */
                class KeyboardInputHandler {
                    constructor(gameBoard, messageHandler) {
                        this.gameBoard = gameBoard;
                        this.messageHandler = messageHandler;
                        this.isGameActive = true;
                        this.lastMoveTime = 0;
                        this.moveThrottleMs = 100; // Minimum time between moves
                        
                        this.setupEventListeners();
                        this.setupFocusManagement();
                    }

                    /**
                     * Set up keyboard event listeners
                     */
                    setupEventListeners() {
                        // Add keyboard event listener to the game board
                        this.gameBoard.addEventListener('keydown', (event) => {
                            this.handleKeyDown(event);
                        });

                        // Also listen on document for global key handling
                        document.addEventListener('keydown', (event) => {
                            // Only handle if the game board is focused or no other input is focused
                            const activeElement = document.activeElement;
                            const isInputFocused = activeElement && (
                                activeElement.tagName === 'INPUT' ||
                                activeElement.tagName === 'TEXTAREA' ||
                                activeElement.contentEditable === 'true'
                            );

                            if (!isInputFocused) {
                                this.handleKeyDown(event);
                            }
                        });

                        // Handle focus events
                        this.gameBoard.addEventListener('focus', () => {
                            this.gameBoard.classList.add('focused');
                        });

                        this.gameBoard.addEventListener('blur', () => {
                            this.gameBoard.classList.remove('focused');
                        });
                    }

                    /**
                     * Set up focus management for accessibility
                     */
                    setupFocusManagement() {
                        // Make game board focusable
                        if (!this.gameBoard.hasAttribute('tabindex')) {
                            this.gameBoard.setAttribute('tabindex', '0');
                        }

                        // Auto-focus the game board when the page loads
                        setTimeout(() => {
                            this.focusGameBoard();
                        }, 100);

                        // Re-focus after new game
                        window.addEventListener('message', (event) => {
                            if (event.data.type === 'newGame') {
                                setTimeout(() => {
                                    this.focusGameBoard();
                                }, 100);
                            }
                        });
                    }

                    /**
                     * Handle keydown events
                     * @param {KeyboardEvent} event - Keyboard event
                     */
                    handleKeyDown(event) {
                        console.log('🎮 Key pressed:', event.key, 'Game active:', this.isGameActive);
                        
                        if (!this.isGameActive) {
                            console.log('❌ Game not active, ignoring key');
                            return;
                        }

                        // Check if enough time has passed since last move (throttling)
                        const currentTime = Date.now();
                        if (currentTime - this.lastMoveTime < this.moveThrottleMs) {
                            console.log('⏱️ Move throttled');
                            event.preventDefault();
                            return;
                        }

                        const direction = this.getDirectionFromKey(event.key);
                        console.log('🧭 Direction from key:', direction);
                        
                        if (direction) {
                            // Prevent default browser behavior for arrow keys
                            event.preventDefault();
                            event.stopPropagation();
                            
                            console.log('✅ Processing move:', direction);
                            
                            // Validate and process the move
                            if (this.validateMove(direction)) {
                                console.log('✅ Move validated, processing...');
                                this.processMove(direction);
                                this.lastMoveTime = currentTime;
                            } else {
                                console.log('❌ Move validation failed');
                            }
                        } else if (this.isSpecialKey(event.key)) {
                            console.log('🔧 Special key detected');
                            // Handle special keys (like space for new game)
                            this.handleSpecialKey(event.key, event);
                        } else {
                            console.log('❓ Unknown key, ignoring');
                        }
                    }

                    /**
                     * Get movement direction from key press
                     * @param {string} key - Key that was pressed
                     * @returns {string|null} Direction or null if not a movement key
                     */
                    getDirectionFromKey(key) {
                        const keyMap = {
                            'ArrowUp': 'up',
                            'ArrowDown': 'down',
                            'ArrowLeft': 'left',
                            'ArrowRight': 'right',
                            'w': 'up',
                            'W': 'up',
                            's': 'down',
                            'S': 'down',
                            'a': 'left',
                            'A': 'left',
                            'd': 'right',
                            'D': 'right'
                        };

                        return keyMap[key] || null;
                    }

                    /**
                     * Check if key is a special function key
                     * @param {string} key - Key that was pressed
                     * @returns {boolean} True if special key
                     */
                    isSpecialKey(key) {
                        const specialKeys = [' ', 'Enter', 'r', 'R', 'n', 'N'];
                        return specialKeys.includes(key);
                    }

                    /**
                     * Handle special key presses
                     * @param {string} key - Key that was pressed
                     * @param {KeyboardEvent} event - Keyboard event
                     */
                    handleSpecialKey(key, event) {
                        switch (key) {
                            case ' ':
                            case 'Enter':
                            case 'r':
                            case 'R':
                            case 'n':
                            case 'N':
                                // Start new game
                                event.preventDefault();
                                this.messageHandler({ type: 'requestNewGame' });
                                break;
                        }
                    }

                    /**
                     * Validate if a move is allowed
                     * @param {string} direction - Movement direction
                     * @returns {boolean} True if move is valid
                     */
                    validateMove(direction) {
                        // Basic validation - check if game is in playing state
                        if (!this.isGameActive) {
                            return false;
                        }

                        // Check if direction is valid
                        const validDirections = ['up', 'down', 'left', 'right'];
                        if (!validDirections.includes(direction)) {
                            return false;
                        }

                        return true;
                    }

                    /**
                     * Process a validated move
                     * @param {string} direction - Movement direction
                     */
                    processMove(direction) {
                        try {
                            console.log('🚀 Sending move to extension:', direction);
                            
                            // Send move message to extension
                            this.messageHandler({
                                type: 'gameMove',
                                direction: direction
                            });

                            console.log('✅ Move message sent successfully');

                            // Provide visual feedback
                            this.provideMovefeedback(direction);
                        } catch (error) {
                            console.error('❌ Error processing move:', error);
                        }
                    }

                    /**
                     * Provide visual feedback for moves
                     * @param {string} direction - Movement direction
                     */
                    provideMovefeedback(direction) {
                        // Add a subtle visual indication of the move direction
                        this.gameBoard.classList.add(\`move-\${direction}\`);
                        
                        setTimeout(() => {
                            this.gameBoard.classList.remove(\`move-\${direction}\`);
                        }, 150);
                    }

                    /**
                     * Focus the game board for keyboard input
                     */
                    focusGameBoard() {
                        if (this.gameBoard && typeof this.gameBoard.focus === 'function') {
                            this.gameBoard.focus();
                        }
                    }

                    /**
                     * Set game active state
                     * @param {boolean} active - Whether game is active
                     */
                    setGameActive(active) {
                        this.isGameActive = active;
                        
                        if (active) {
                            this.gameBoard.classList.remove('game-inactive');
                            this.focusGameBoard();
                        } else {
                            this.gameBoard.classList.add('game-inactive');
                        }
                    }

                    /**
                     * Update move throttle timing
                     * @param {number} throttleMs - Throttle time in milliseconds
                     */
                    setMoveThrottle(throttleMs) {
                        this.moveThrottleMs = Math.max(50, Math.min(500, throttleMs));
                    }

                    /**
                     * Clean up event listeners
                     */
                    destroy() {
                        // Remove event listeners if needed
                        // This would be called when the webview is destroyed
                    }
                }

                // Create keyboard input handler
                let keyboardHandler = null;

                // Global error handler
                window.addEventListener('error', (event) => {
                    console.error('Global error:', event.error);
                    uiRenderer.showError('An unexpected error occurred');
                });

                // Enhanced message handler that supports game moves
                function handleMessage(message) {
                    try {
                        vscode.postMessage(message);
                    } catch (error) {
                        console.error('Error sending message:', error);
                        uiRenderer.showError('Failed to communicate with extension');
                    }
                }
                
                // Enhanced initialization with comprehensive error handling
                function initializeGame() {
                    return errorBoundary.wrap(() => {
                        console.log('Starting game initialization...');
                        
                        // Initialize UI renderer
                        if (!window.uiRenderer) {
                            throw new Error('UI renderer not available');
                        }
                        
                        window.uiRenderer.initializeBoard();
                        console.log('Board initialized');
                        
                        // Initialize keyboard handler after board is ready
                        const gameBoard = document.getElementById('gameBoard');
                        if (!gameBoard) {
                            throw new Error('Game board element not found during initialization');
                        }
                        
                        if (!window.keyboardHandler) {
                            window.keyboardHandler = new KeyboardInputHandler(gameBoard, handleMessage);
                            console.log('Keyboard handler initialized');
                            
                            // Force focus on the game board
                            setTimeout(() => {
                                gameBoard.focus();
                                console.log('Game board focused');
                            }, 200);
                        }
                        
                        // Request initial data
                        requestTheme();
                        
                        // Try to load saved game
                        try {
                            vscode.postMessage({ type: 'requestSavedGame' });
                        } catch (error) {
                            console.warn('Failed to request saved game:', error);
                            // Continue without saved game
                        }
                        
                        // Set up theme refresh on visibility change
                        document.addEventListener('visibilitychange', errorBoundary.wrap(() => {
                            if (!document.hidden) {
                                console.log('Webview became visible, refreshing theme');
                                requestTheme();
                            }
                        }, 'VISIBILITY_CHANGE_ERROR'));
                        
                        // Set up periodic health check
                        setInterval(errorBoundary.wrap(() => {
                            // Verify essential elements still exist
                            if (!document.getElementById('gameBoard') || 
                                !document.getElementById('score') || 
                                !document.getElementById('gameStatus')) {
                                throw new Error('Essential game elements missing');
                            }
                        }, 'HEALTH_CHECK_ERROR'), 30000); // Check every 30 seconds
                        
                        console.log('Game initialization completed successfully');
                    }, 'INITIALIZATION_ERROR')();
                }

                // Initialize with retry mechanism
                function initializeWithRetry(maxRetries = 3, delay = 1000) {
                    let retries = 0;
                    
                    function attempt() {
                        try {
                            initializeGame();
                        } catch (error) {
                            retries++;
                            console.error(\`Initialization attempt \${retries} failed:\`, error);
                            
                            if (retries < maxRetries) {
                                console.log(\`Retrying initialization in \${delay}ms...\`);
                                setTimeout(attempt, delay);
                                delay *= 2; // Exponential backoff
                            } else {
                                console.error('All initialization attempts failed');
                                errorBoundary.handleError(
                                    new Error('Failed to initialize after multiple attempts'), 
                                    'INITIALIZATION_FAILURE',
                                    { attempts: retries }
                                );
                            }
                        }
                    }
                    
                    attempt();
                }

                // Start initialization when DOM is ready
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', initializeWithRetry);
                } else {
                    initializeWithRetry();
                }
            </script>
        </body>
        </html>`;
    }
}