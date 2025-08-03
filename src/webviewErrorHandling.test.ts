import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock VSCode API
const mockVscode = {
    postMessage: vi.fn(),
};

// Mock DOM elements
const mockElements = {
    gameBoard: {
        id: 'gameBoard',
        innerHTML: '',
        appendChild: vi.fn(),
        removeChild: vi.fn(),
        firstChild: null,
        querySelectorAll: vi.fn(() => []),
        classList: {
            add: vi.fn(),
            remove: vi.fn(),
            contains: vi.fn(() => false),
        },
        addEventListener: vi.fn(),
        focus: vi.fn(),
    },
    score: {
        id: 'score',
        textContent: '0',
    },
    gameStatus: {
        id: 'gameStatus',
        textContent: '',
        className: '',
        setAttribute: vi.fn(),
    },
};

// Mock document
const mockDocument = {
    getElementById: vi.fn((id: string) => {
        switch (id) {
            case 'gameBoard':
                return mockElements.gameBoard;
            case 'score':
                return mockElements.score;
            case 'gameStatus':
                return mockElements.gameStatus;
            default:
                return null;
        }
    }),
    createElement: vi.fn((tagName: string) => ({
        tagName: tagName.toUpperCase(),
        className: '',
        id: '',
        textContent: '',
        setAttribute: vi.fn(),
        classList: {
            add: vi.fn(),
            remove: vi.fn(),
            contains: vi.fn(() => false),
        },
    })),
    createDocumentFragment: vi.fn(() => ({
        appendChild: vi.fn(),
    })),
    addEventListener: vi.fn(),
    readyState: 'complete',
};

// Mock window
const mockWindow = {
    addEventListener: vi.fn(),
    performance: {
        now: vi.fn(() => Date.now()),
    },
    requestAnimationFrame: vi.fn((callback: Function) => {
        setTimeout(callback, 16);
        return 1;
    }),
    setTimeout: vi.fn((callback: Function, delay: number) => {
        setTimeout(callback, delay);
        return 1;
    }),
    setInterval: vi.fn((callback: Function, delay: number) => {
        setInterval(callback, delay);
        return 1;
    }),
};

// Mock console to capture error logs
const mockConsole = {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
};

describe('Webview Error Handling', () => {
    let ErrorBoundary: any;
    let UIRenderer: any;
    let errorBoundary: any;
    let uiRenderer: any;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();
        
        // Set up global mocks
        global.vscode = mockVscode;
        global.document = mockDocument as any;
        global.window = mockWindow as any;
        global.console = mockConsole as any;
        Object.defineProperty(global, 'navigator', {
            value: { userAgent: 'test-agent' },
            writable: true,
            configurable: true
        });
        global.alert = vi.fn();

        // Reset mock elements
        mockElements.gameBoard.innerHTML = '';
        mockElements.gameBoard.firstChild = null;
        mockElements.score.textContent = '0';
        mockElements.gameStatus.textContent = '';
        mockElements.gameStatus.className = '';

        // Create ErrorBoundary class (simplified version for testing)
        ErrorBoundary = class {
            constructor() {
                this.errorCount = 0;
                this.maxErrors = 5;
                this.errorResetTime = 30000;
                this.lastErrorTime = 0;
                this.criticalErrors = new Set(['GAME_ENGINE_FAILURE', 'RENDERER_FAILURE', 'COMMUNICATION_FAILURE']);
            }

            handleError(error: Error, errorCode = 'UNKNOWN_ERROR', context = {}) {
                const now = Date.now();
                
                if (now - this.lastErrorTime > this.errorResetTime) {
                    this.errorCount = 0;
                }
                
                this.errorCount++;
                this.lastErrorTime = now;

                mockConsole.error('Error caught by ErrorBoundary:', {
                    error: error.message,
                    code: errorCode,
                    context: context,
                    count: this.errorCount
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
                this.showError(userMessage, false);
            }

            handleCriticalError(error: Error, errorCode: string, context: any) {
                const userMessage = this.getUserFriendlyMessage(errorCode, error.message);
                this.showError(userMessage, true);
            }

            getUserFriendlyMessage(errorCode: string, originalMessage: string) {
                const messages: { [key: string]: string } = {
                    'RENDER_ERROR': 'Display error occurred. Refreshing the game board.',
                    'BOARD_INITIALIZATION_ERROR': 'Failed to initialize game board.',
                    'TILE_UPDATE_ERROR': 'Failed to update tile display.',
                };
                return messages[errorCode] || `An error occurred: ${originalMessage}`;
            }

            showError(message: string, isCritical = false) {
                const statusElement = mockElements.gameStatus;
                if (statusElement) {
                    statusElement.textContent = message;
                    statusElement.className = `game-status ${isCritical ? 'lost' : 'playing'}`;
                }
            }

            wrap(fn: Function, errorCode = 'WRAPPED_FUNCTION_ERROR', context = {}) {
                return (...args: any[]) => {
                    try {
                        return fn.apply(this, args);
                    } catch (error) {
                        this.handleError(error as Error, errorCode, { ...context, args });
                        return null;
                    }
                };
            }

            reset() {
                this.errorCount = 0;
                this.lastErrorTime = 0;
            }
        };

        // Create UIRenderer class (simplified version for testing)
        UIRenderer = class {
            constructor() {
                this.boardElement = mockElements.gameBoard;
                this.scoreElement = mockElements.score;
                this.statusElement = mockElements.gameStatus;
                this.previousBoard = null;
                this.renderAttempts = 0;
                this.maxRenderAttempts = 3;

                if (!this.boardElement) {
                    throw new Error('Game board element not found');
                }
                if (!this.scoreElement) {
                    throw new Error('Score element not found');
                }
                if (!this.statusElement) {
                    throw new Error('Status element not found');
                }
            }

            initializeBoard() {
                return errorBoundary.wrap(() => {
                    if (!this.boardElement) {
                        throw new Error('Game board element not found');
                    }
                    
                    // Clear existing content
                    this.boardElement.innerHTML = '';
                    
                    // Create 16 tiles
                    const tiles = [];
                    for (let row = 0; row < 4; row++) {
                        for (let col = 0; col < 4; col++) {
                            const tile = mockDocument.createElement('div');
                            tile.className = 'tile empty';
                            tile.id = `tile-${row}-${col}`;
                            tiles.push(tile);
                        }
                    }
                    
                    // Mock querySelectorAll to return our tiles
                    mockElements.gameBoard.querySelectorAll = vi.fn(() => tiles);
                    
                    if (tiles.length !== 16) {
                        throw new Error(`Expected 16 tiles, found ${tiles.length}`);
                    }
                    
                    this.previousBoard = Array(4).fill().map(() => Array(4).fill(0));
                    this.renderAttempts = 0;
                }, 'BOARD_INITIALIZATION_ERROR', { method: 'initializeBoard' })();
            }

            renderBoard(board: number[][]) {
                return errorBoundary.wrap(() => {
                    if (!board || !Array.isArray(board) || board.length !== 4) {
                        throw new Error(`Invalid board data: expected 4x4 array, got ${board ? board.length : 'null'}`);
                    }
                    
                    for (let i = 0; i < 4; i++) {
                        if (!Array.isArray(board[i]) || board[i].length !== 4) {
                            throw new Error(`Invalid board row ${i}: expected array of length 4`);
                        }
                        
                        for (let j = 0; j < 4; j++) {
                            const value = board[i][j];
                            if (typeof value !== 'number' || value < 0 || !Number.isInteger(value)) {
                                throw new Error(`Invalid cell value at [${i}][${j}]: ${value}`);
                            }
                        }
                    }

                    this.renderAttempts++;
                    if (this.renderAttempts > this.maxRenderAttempts) {
                        throw new Error('Maximum render attempts exceeded');
                    }

                    this.previousBoard = board.map(row => [...row]);
                    this.renderAttempts = 0;
                }, 'RENDER_ERROR', { method: 'renderBoard', boardSize: board ? board.length : 0 })();
            }

            updateTile(row: number, col: number, value: number) {
                return errorBoundary.wrap(() => {
                    if (typeof row !== 'number' || row < 0 || row >= 4) {
                        throw new Error(`Invalid row: ${row}`);
                    }
                    if (typeof col !== 'number' || col < 0 || col >= 4) {
                        throw new Error(`Invalid col: ${col}`);
                    }
                    if (typeof value !== 'number' || value < 0 || !Number.isInteger(value)) {
                        throw new Error(`Invalid value: ${value}`);
                    }

                    // Mock tile element
                    const tile = {
                        className: 'tile',
                        textContent: '',
                        setAttribute: vi.fn(),
                        classList: {
                            add: vi.fn(),
                            remove: vi.fn(),
                            contains: vi.fn((className: string) => {
                                return tile.className.includes(className);
                            }),
                        },
                    };

                    // Mock getElementById to return our tile
                    mockDocument.getElementById = vi.fn((id: string) => {
                        if (id === `tile-${row}-${col}`) {
                            return tile;
                        }
                        return mockElements[id as keyof typeof mockElements] || null;
                    });

                    if (value === 0) {
                        tile.className += ' empty';
                        tile.textContent = '';
                    } else {
                        tile.className += ` tile-${value}`;
                        tile.textContent = value.toString();
                    }

                    // Verify the update
                    if (value === 0 && !tile.classList.contains('empty')) {
                        throw new Error('Failed to set empty tile class');
                    }
                    if (value > 0 && !tile.classList.contains(`tile-${value}`)) {
                        throw new Error(`Failed to set tile-${value} class`);
                    }
                }, 'TILE_UPDATE_ERROR', { method: 'updateTile', row, col, value })();
            }

            showError(message: string, isCritical = false) {
                if (this.statusElement) {
                    this.statusElement.textContent = 'Error: ' + message;
                    this.statusElement.className = `game-status ${isCritical ? 'lost' : 'playing'}`;
                }
            }
        };

        // Create instances
        errorBoundary = new ErrorBoundary();
        uiRenderer = new UIRenderer();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('ErrorBoundary', () => {
        it('should handle recoverable errors', () => {
            const error = new Error('Test error');
            errorBoundary.handleError(error, 'RENDER_ERROR');

            expect(mockConsole.error).toHaveBeenCalledWith(
                'Error caught by ErrorBoundary:',
                expect.objectContaining({
                    error: 'Test error',
                    code: 'RENDER_ERROR',
                    count: 1
                })
            );

            expect(mockElements.gameStatus.textContent).toBe('Display error occurred. Refreshing the game board.');
            expect(mockElements.gameStatus.className).toBe('game-status playing');
        });

        it('should handle critical errors', () => {
            const error = new Error('Critical test error');
            errorBoundary.handleError(error, 'GAME_ENGINE_FAILURE');

            expect(mockElements.gameStatus.className).toBe('game-status lost');
        });

        it('should escalate to critical after max errors', () => {
            const error = new Error('Repeated error');
            
            // Trigger multiple errors
            for (let i = 0; i < 5; i++) {
                errorBoundary.handleError(error, 'RENDER_ERROR');
            }

            expect(mockElements.gameStatus.className).toBe('game-status lost');
        });

        it('should wrap functions with error handling', () => {
            const throwingFunction = () => {
                throw new Error('Function error');
            };

            const wrappedFunction = errorBoundary.wrap(throwingFunction, 'TEST_ERROR');
            const result = wrappedFunction();

            expect(result).toBeNull();
            expect(mockConsole.error).toHaveBeenCalled();
        });

        it('should reset error count after timeout', () => {
            const error = new Error('Test error');
            
            // Set last error time to past
            errorBoundary.lastErrorTime = Date.now() - 31000; // 31 seconds ago
            errorBoundary.errorCount = 3;
            
            errorBoundary.handleError(error, 'RENDER_ERROR');
            
            expect(errorBoundary.errorCount).toBe(1); // Should reset and then increment
        });
    });

    describe('UIRenderer Error Handling', () => {
        it('should handle board initialization errors', () => {
            // Make boardElement null to trigger error
            uiRenderer.boardElement = null;
            
            uiRenderer.initializeBoard();
            
            expect(mockConsole.error).toHaveBeenCalled();
        });

        it('should validate board data in renderBoard', () => {
            const invalidBoard = [[1, 2], [3, 4]]; // Wrong size
            
            uiRenderer.renderBoard(invalidBoard);
            
            expect(mockConsole.error).toHaveBeenCalledWith(
                'Error caught by ErrorBoundary:',
                expect.objectContaining({
                    code: 'RENDER_ERROR'
                })
            );
        });

        it('should validate cell values in renderBoard', () => {
            const invalidBoard = [
                [1, 2, 3, 4],
                [5, 6, 7, 8],
                [9, 10, 11, 'invalid'], // Invalid cell value
                [13, 14, 15, 16]
            ];
            
            uiRenderer.renderBoard(invalidBoard as any);
            
            expect(mockConsole.error).toHaveBeenCalled();
        });

        it('should handle tile update parameter validation', () => {
            uiRenderer.updateTile(-1, 0, 2); // Invalid row
            
            expect(mockConsole.error).toHaveBeenCalledWith(
                'Error caught by ErrorBoundary:',
                expect.objectContaining({
                    code: 'TILE_UPDATE_ERROR'
                })
            );
        });

        it('should handle maximum render attempts', () => {
            const validBoard = [
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0]
            ];
            
            // Set render attempts to max
            uiRenderer.renderAttempts = 3;
            
            uiRenderer.renderBoard(validBoard);
            
            expect(mockConsole.error).toHaveBeenCalled();
        });

        it('should successfully render valid board', () => {
            const validBoard = [
                [2, 0, 0, 4],
                [0, 8, 0, 0],
                [0, 0, 16, 0],
                [32, 0, 0, 64]
            ];
            
            uiRenderer.renderBoard(validBoard);
            
            expect(uiRenderer.previousBoard).toEqual(validBoard);
            expect(uiRenderer.renderAttempts).toBe(0); // Should reset on success
        });
    });

    describe('Error Recovery', () => {
        it('should show error messages with appropriate styling', () => {
            uiRenderer.showError('Test error message', false);
            
            expect(mockElements.gameStatus.textContent).toBe('Error: Test error message');
            expect(mockElements.gameStatus.className).toBe('game-status playing');
        });

        it('should show critical error messages', () => {
            uiRenderer.showError('Critical error', true);
            
            expect(mockElements.gameStatus.textContent).toBe('Error: Critical error');
            expect(mockElements.gameStatus.className).toBe('game-status lost');
        });

        it('should handle showError failures gracefully', () => {
            // Make statusElement null
            uiRenderer.statusElement = null;
            
            // Should not throw
            expect(() => {
                uiRenderer.showError('Test error');
            }).not.toThrow();
            
            expect(mockConsole.error).toHaveBeenCalledWith('Failed to show error message:', expect.any(Error));
        });
    });
});