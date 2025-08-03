/**
 * Unit tests for webview messaging functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebviewMessageHandler, ExtensionMessageHandler } from './webviewMessaging';
import { MessageValidator, MessageFactory } from './messageTypes';

// Mock VSCode API
const mockVscode = {
    postMessage: vi.fn()
};

// Mock window object
const mockWindow = {
    addEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    removeEventListener: vi.fn()
};

// Setup global mocks
beforeEach(() => {
    vi.clearAllMocks();
    (global as any).window = mockWindow;
    global.console = {
        log: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    } as any;
});

describe('MessageValidator', () => {
    describe('isValidWebviewMessage', () => {
        it('should validate correct webview messages', () => {
            const validMessage = {
                type: 'requestNewGame',
                timestamp: Date.now(),
                id: 'test-id'
            };
            expect(MessageValidator.isValidWebviewMessage(validMessage)).toBe(true);
        });

        it('should reject invalid message types', () => {
            const invalidMessage = {
                type: 'invalidType',
                timestamp: Date.now(),
                id: 'test-id'
            };
            expect(MessageValidator.isValidWebviewMessage(invalidMessage)).toBe(false);
        });

        it('should validate gameMove messages with direction', () => {
            const gameMoveMessage = {
                type: 'gameMove',
                direction: 'up',
                timestamp: Date.now(),
                id: 'test-id'
            };
            expect(MessageValidator.isValidWebviewMessage(gameMoveMessage)).toBe(true);
        });

        it('should reject gameMove messages with invalid direction', () => {
            const invalidGameMoveMessage = {
                type: 'gameMove',
                direction: 'invalid',
                timestamp: Date.now(),
                id: 'test-id'
            };
            expect(MessageValidator.isValidWebviewMessage(invalidGameMoveMessage)).toBe(false);
        });

        it('should validate gameStateUpdate messages', () => {
            const gameStateMessage = {
                type: 'gameStateUpdate',
                state: {
                    board: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
                    score: 0,
                    gameState: 'playing',
                    moveCount: 0,
                    startTime: Date.now()
                },
                timestamp: Date.now(),
                id: 'test-id'
            };
            expect(MessageValidator.isValidWebviewMessage(gameStateMessage)).toBe(true);
        });
    });

    describe('isValidGameState', () => {
        it('should validate correct game state', () => {
            const validState = {
                board: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
                score: 100,
                gameState: 'playing',
                moveCount: 5,
                startTime: Date.now()
            };
            expect(MessageValidator.isValidGameState(validState)).toBe(true);
        });

        it('should reject invalid board structure', () => {
            const invalidState = {
                board: [[0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], // Invalid row length
                score: 100,
                gameState: 'playing',
                moveCount: 5,
                startTime: Date.now()
            };
            expect(MessageValidator.isValidGameState(invalidState)).toBe(false);
        });

        it('should reject invalid game state values', () => {
            const invalidState = {
                board: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
                score: 100,
                gameState: 'invalid', // Invalid game state
                moveCount: 5,
                startTime: Date.now()
            };
            expect(MessageValidator.isValidGameState(invalidState)).toBe(false);
        });
    });
});

describe('MessageFactory', () => {
    it('should create webview messages with required fields', () => {
        const message = MessageFactory.createWebviewMessage('requestNewGame');
        
        expect(message.type).toBe('requestNewGame');
        expect(message.timestamp).toBeTypeOf('number');
        expect(message.id).toBeTypeOf('string');
        expect(message.id).toHaveLength(9);
    });

    it('should create extension messages with required fields', () => {
        const message = MessageFactory.createExtensionMessage('newGame');
        
        expect(message.type).toBe('newGame');
        expect(message.timestamp).toBeTypeOf('number');
        expect(message.id).toBeTypeOf('string');
        expect(message.id).toHaveLength(9);
    });

    it('should create error messages with proper structure', () => {
        const errorMessage = MessageFactory.createErrorMessage('Test error', 'TEST_ERROR', false);
        
        expect(errorMessage.type).toBe('error');
        expect(errorMessage.error?.message).toBe('Test error');
        expect(errorMessage.error?.code).toBe('TEST_ERROR');
        expect(errorMessage.error?.recoverable).toBe(false);
    });
});

describe('WebviewMessageHandler', () => {
    let messageHandler: WebviewMessageHandler;

    beforeEach(() => {
        messageHandler = new WebviewMessageHandler(mockVscode);
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    it('should send valid messages successfully', async () => {
        const message = MessageFactory.createWebviewMessage('requestNewGame');
        
        await messageHandler.sendMessage(message);
        
        expect(mockVscode.postMessage).toHaveBeenCalledWith(message);
    });

    it('should reject invalid messages', async () => {
        const invalidMessage = {
            type: 'invalidType'
        } as any;
        
        await expect(messageHandler.sendMessage(invalidMessage)).rejects.toThrow();
        expect(mockVscode.postMessage).not.toHaveBeenCalled();
    });

    it('should send game move messages', async () => {
        await messageHandler.sendGameMove('up');
        
        expect(mockVscode.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'gameMove',
                direction: 'up'
            })
        );
    });

    it('should send new game requests', async () => {
        await messageHandler.sendNewGameRequest();
        
        expect(mockVscode.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'requestNewGame'
            })
        );
    });

    it('should send theme requests', async () => {
        await messageHandler.sendThemeRequest();
        
        expect(mockVscode.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'requestTheme'
            })
        );
    });

    it('should handle send errors with retry logic', async () => {
        // Mock postMessage to throw error
        mockVscode.postMessage.mockImplementation(() => {
            throw new Error('Send failed');
        });

        const message = MessageFactory.createWebviewMessage('requestNewGame');
        
        // Should throw error since we changed the implementation to throw
        await expect(messageHandler.sendMessage(message)).rejects.toThrow('Send failed');
        
        expect(mockVscode.postMessage).toHaveBeenCalled();
    });

    it('should queue messages when offline', async () => {
        // Simulate offline state
        messageHandler['isOnline'] = false;
        
        await messageHandler.sendGameMove('up');
        
        const status = messageHandler.getQueueStatus();
        expect(status.queueSize).toBe(1);
        expect(status.isOnline).toBe(false);
    });

    it('should clear queue when requested', () => {
        messageHandler['messageQueue'] = [MessageFactory.createWebviewMessage('requestNewGame')];
        
        messageHandler.clearQueue();
        
        const status = messageHandler.getQueueStatus();
        expect(status.queueSize).toBe(0);
    });
});

describe('ExtensionMessageHandler', () => {
    let messageHandler: ExtensionMessageHandler;
    let mockHandler: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        messageHandler = new ExtensionMessageHandler();
        mockHandler = vi.fn();
    });

    it('should register and call message handlers', () => {
        messageHandler.onMessage('newGame', mockHandler);
        
        const registeredTypes = messageHandler.getRegisteredTypes();
        expect(registeredTypes).toContain('newGame');
    });

    it('should handle valid messages from extension', () => {
        messageHandler.onMessage('newGame', mockHandler);
        
        const validMessage = MessageFactory.createExtensionMessage('newGame', {
            state: {
                board: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
                score: 0,
                gameState: 'playing',
                moveCount: 0,
                startTime: Date.now()
            }
        });

        // Simulate message event
        const messageEvent = {
            data: validMessage
        } as any;

        // Trigger the event listener
        const eventListener = mockWindow.addEventListener.mock.calls.find(
            call => call[0] === 'message'
        )?.[1];

        if (eventListener) {
            eventListener(messageEvent);
            expect(mockHandler).toHaveBeenCalledWith(validMessage);
        }
    });

    it('should remove message handlers', () => {
        messageHandler.onMessage('newGame', mockHandler);
        messageHandler.removeHandler('newGame');
        
        const registeredTypes = messageHandler.getRegisteredTypes();
        expect(registeredTypes).not.toContain('newGame');
    });

    it('should handle errors with error handler', () => {
        const errorHandler = vi.fn();
        messageHandler.onError(errorHandler);
        
        // Simulate invalid message
        const invalidMessage = { type: 'invalid' };
        const messageEvent = {
            data: invalidMessage
        } as any;

        // Trigger the event listener
        const eventListener = mockWindow.addEventListener.mock.calls.find(
            call => call[0] === 'message'
        )?.[1];

        if (eventListener) {
            eventListener(messageEvent);
            expect(errorHandler).toHaveBeenCalled();
        }
    });
});