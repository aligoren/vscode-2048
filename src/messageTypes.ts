/**
 * Message type definitions for communication between webview and extension
 * This file defines all message types used in the 2048 game extension
 */

// Base message interface
export interface BaseMessage {
    type: string;
    timestamp?: number;
    id?: string;
}

// Game state interface
export interface GameState {
    board: number[][];
    score: number;
    gameState: 'playing' | 'won' | 'lost';
    moveCount: number;
    startTime: number;
}

// Theme data interface
export interface ThemeData {
    kind: number;
    isHighContrast: boolean;
    isDark: boolean;
    backgroundColor: string;
    foregroundColor: string;
    accentColor: string;
    tileColors: { [value: number]: string };
}

// Messages sent from webview to extension
// Share data interface
export interface ShareData {
    score: number;
    highestTile: number;
    moveCount: number;
    gameState: 'playing' | 'won' | 'lost';
    imageData?: string; // Base64 encoded screenshot
}

export interface WebviewToExtensionMessage extends BaseMessage {
    type: 'requestNewGame' | 'gameMove' | 'gameStateUpdate' | 'requestTheme' | 'requestSavedGame' | 'shareScore' | 'error';
    direction?: 'up' | 'down' | 'left' | 'right';
    state?: GameState;
    shareData?: ShareData;
    error?: {
        message: string;
        stack?: string;
        context?: any;
    };
}

// Messages sent from extension to webview
export interface ExtensionToWebviewMessage extends BaseMessage {
    type: 'newGame' | 'gameStateUpdate' | 'themeChanged' | 'error' | 'gameStateChanged';
    state?: GameState;
    theme?: ThemeData;
    error?: {
        message: string;
        code?: string;
        recoverable?: boolean;
    };
}

// Message validation utilities
export class MessageValidator {
    static isValidWebviewMessage(message: any): message is WebviewToExtensionMessage {
        if (!message || typeof message !== 'object') {
            return false;
        }

        const validTypes = ['requestNewGame', 'gameMove', 'gameStateUpdate', 'requestTheme', 'requestSavedGame', 'error'];
        if (!validTypes.includes(message.type)) {
            return false;
        }

        // Validate specific message types
        switch (message.type) {
            case 'gameMove':
                const validDirections = ['up', 'down', 'left', 'right'];
                return typeof message.direction === 'string' && validDirections.includes(message.direction);
            
            case 'gameStateUpdate':
                return message.state && MessageValidator.isValidGameState(message.state);
            
            case 'error':
                return message.error && typeof message.error.message === 'string';
            
            default:
                return true;
        }
    }

    static isValidExtensionMessage(message: any): message is ExtensionToWebviewMessage {
        if (!message || typeof message !== 'object') {
            return false;
        }

        const validTypes = ['newGame', 'gameStateUpdate', 'themeChanged', 'error', 'gameStateChanged'];
        if (!validTypes.includes(message.type)) {
            return false;
        }

        // Validate specific message types
        switch (message.type) {
            case 'newGame':
            case 'gameStateUpdate':
            case 'gameStateChanged':
                return message.state && MessageValidator.isValidGameState(message.state);
            
            case 'themeChanged':
                return message.theme && MessageValidator.isValidThemeData(message.theme);
            
            case 'error':
                return message.error && typeof message.error.message === 'string';
            
            default:
                return true;
        }
    }

    static isValidGameState(state: any): state is GameState {
        if (!state || typeof state !== 'object') {
            return false;
        }

        // Check required properties
        if (!Array.isArray(state.board) || 
            typeof state.score !== 'number' ||
            typeof state.gameState !== 'string' ||
            typeof state.moveCount !== 'number' ||
            typeof state.startTime !== 'number') {
            return false;
        }

        // Check board structure
        if (state.board.length !== 4) {
            return false;
        }

        for (const row of state.board) {
            if (!Array.isArray(row) || row.length !== 4) {
                return false;
            }
            for (const cell of row) {
                if (typeof cell !== 'number' || cell < 0) {
                    return false;
                }
            }
        }

        // Check game state value
        if (!['playing', 'won', 'lost'].includes(state.gameState)) {
            return false;
        }

        return true;
    }

    static isValidThemeData(theme: any): theme is ThemeData {
        if (!theme || typeof theme !== 'object') {
            return false;
        }

        return typeof theme.kind === 'number' &&
               typeof theme.isHighContrast === 'boolean' &&
               typeof theme.isDark === 'boolean' &&
               typeof theme.backgroundColor === 'string' &&
               typeof theme.foregroundColor === 'string' &&
               typeof theme.accentColor === 'string' &&
               typeof theme.tileColors === 'object';
    }
}

// Message creation utilities
export class MessageFactory {
    static createWebviewMessage(
        type: WebviewToExtensionMessage['type'],
        data?: Partial<WebviewToExtensionMessage>
    ): WebviewToExtensionMessage {
        return {
            type,
            timestamp: Date.now(),
            id: Math.random().toString(36).substr(2, 9),
            ...data
        };
    }

    static createExtensionMessage(
        type: ExtensionToWebviewMessage['type'],
        data?: Partial<ExtensionToWebviewMessage>
    ): ExtensionToWebviewMessage {
        return {
            type,
            timestamp: Date.now(),
            id: Math.random().toString(36).substr(2, 9),
            ...data
        };
    }

    static createErrorMessage(
        message: string,
        code?: string,
        recoverable: boolean = true
    ): ExtensionToWebviewMessage {
        return MessageFactory.createExtensionMessage('error', {
            error: {
                message,
                code,
                recoverable
            }
        });
    }
}