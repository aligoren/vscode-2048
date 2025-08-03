import { describe, it, beforeEach, expect, vi } from 'vitest';
import { GameController, GameState } from './gameController';
import { GameStateSerialization } from './gameStateSerialization';

// Mock VSCode API
vi.mock('vscode', () => ({
    ExtensionContext: vi.fn()
}));

describe('GameController', () => {
    let controller: GameController;
    let mockContext: any;
    let mockGameViewProvider: any;

    beforeEach(() => {
        // Create mock context
        mockContext = {
            globalState: {
                get: vi.fn(),
                update: vi.fn()
            }
        };

        // Create mock game view provider
        mockGameViewProvider = {
            postMessage: vi.fn()
        };

        controller = new GameController(mockContext);
        controller.setGameViewProvider(mockGameViewProvider);
    });

    it('should create controller instance', () => {
        expect(controller).toBeDefined();
        expect(controller).toBeInstanceOf(GameController);
    });

    it('should start new game successfully', () => {
        controller.startNewGame();

        // Should save game state
        expect(mockContext.globalState.update).toHaveBeenCalledWith(
            '2048Game.gameState',
            expect.any(String)
        );

        // Should notify webview
        expect(mockGameViewProvider.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'newGame',
                state: expect.objectContaining({
                    score: 0,
                    gameState: 'playing',
                    moveCount: 0,
                    board: expect.any(Array)
                })
            })
        );
    });

    it('should create valid initial game state', () => {
        controller.startNewGame();

        const postMessageCall = mockGameViewProvider.postMessage.mock.calls[0][0];
        const gameState = postMessageCall.state;

        expect(gameState.board).toHaveLength(4);
        expect(gameState.board[0]).toHaveLength(4);
        expect(gameState.score).toBe(0);
        expect(gameState.gameState).toBe('playing');
        expect(gameState.moveCount).toBe(0);
        expect(gameState.startTime).toBeGreaterThan(0);

        // Should have exactly 2 non-zero tiles
        const nonZeroTiles = gameState.board.flat().filter((cell: number) => cell !== 0);
        expect(nonZeroTiles).toHaveLength(2);
        expect(nonZeroTiles.every((tile: number) => tile === 2 || tile === 4)).toBe(true);
    });

    it('should handle valid game state changes', () => {
        const validState: GameState = {
            board: [
                [2, 4, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0]
            ],
            score: 100,
            gameState: 'playing',
            moveCount: 5,
            startTime: Date.now()
        };

        controller.handleGameStateChange(validState);

        expect(mockContext.globalState.update).toHaveBeenCalledWith(
            '2048Game.gameState',
            expect.any(String)
        );
    });

    it('should reject invalid game state', () => {
        const invalidState = {
            board: [[1, 2], [3]], // Invalid board structure
            score: 'invalid', // Invalid score type
            gameState: 'invalid', // Invalid game state
            moveCount: -1,
            startTime: 'invalid'
        };

        // Should not throw but should handle gracefully
        expect(() => {
            controller.handleGameStateChange(invalidState as any);
        }).not.toThrow();

        // Should post error message
        expect(mockGameViewProvider.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'error',
                error: expect.objectContaining({
                    message: 'Failed to update game state'
                })
            })
        );
    });

    it('should save game state to storage using serialization', () => {
        const gameState: GameState = {
            board: [[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
            score: 50,
            gameState: 'playing',
            moveCount: 3,
            startTime: Date.now()
        };

        controller.saveGameState(gameState);

        expect(mockContext.globalState.update).toHaveBeenCalledWith(
            '2048Game.gameState',
            expect.any(String)
        );

        // Verify the saved data can be deserialized
        const savedData = mockContext.globalState.update.mock.calls[0][1];
        const deserializeResult = GameStateSerialization.deserialize(savedData);
        expect(deserializeResult.success).toBe(true);
        expect(deserializeResult.state).toEqual(gameState);
    });

    it('should load valid game state from storage using deserialization', () => {
        const gameState: GameState = {
            board: [[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
            score: 75,
            gameState: 'playing',
            moveCount: 4,
            startTime: Date.now()
        };

        // Serialize the state properly
        const serializeResult = GameStateSerialization.serialize(gameState);
        mockContext.globalState.get.mockReturnValue(serializeResult.data);

        const loadedState = controller.loadGameState();

        expect(loadedState).toEqual(gameState);
        expect(mockContext.globalState.get).toHaveBeenCalledWith('2048Game.gameState');
    });

    it('should return null for missing saved state', () => {
        mockContext.globalState.get.mockReturnValue(undefined);

        const loadedState = controller.loadGameState();

        expect(loadedState).toBeNull();
    });

    it('should return null for corrupted saved state and clean it up', () => {
        mockContext.globalState.get.mockReturnValue('invalid json');

        const loadedState = controller.loadGameState();

        expect(loadedState).toBeNull();
        // Should clean up corrupted state
        expect(mockContext.globalState.update).toHaveBeenCalledWith('2048Game.gameState', undefined);
    });

    it('should handle requestNewGame message', () => {
        const message = { type: 'requestNewGame' };

        controller.handleMessage(message);

        expect(mockGameViewProvider.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'newGame',
                state: expect.any(Object)
            })
        );
    });

    it('should handle gameStateUpdate message', () => {
        const gameState: GameState = {
            board: [[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
            score: 25,
            gameState: 'playing',
            moveCount: 2,
            startTime: Date.now()
        };

        const message = { type: 'gameStateUpdate', state: gameState };

        controller.handleMessage(message);

        expect(mockContext.globalState.update).toHaveBeenCalled();
    });

    it('should handle requestSavedGame message', () => {
        const gameState: GameState = {
            board: [[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
            score: 100,
            gameState: 'playing',
            moveCount: 5,
            startTime: Date.now()
        };

        // Serialize the state properly
        const serializeResult = GameStateSerialization.serialize(gameState);
        mockContext.globalState.get.mockReturnValue(serializeResult.data);

        const message = { type: 'requestSavedGame' };

        controller.handleMessage(message);

        expect(mockGameViewProvider.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'gameStateChanged',
                state: gameState
            })
        );
    });

    it('should handle unknown message types gracefully', () => {
        const message = { type: 'unknownType', data: 'test' };

        expect(() => {
            controller.handleMessage(message);
        }).not.toThrow();
    });

    it('should detect win condition', () => {
        const winningState: GameState = {
            board: [
                [2048, 4, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0]
            ],
            score: 2000,
            gameState: 'playing',
            moveCount: 10,
            startTime: Date.now()
        };

        controller.handleGameStateChange(winningState);

        // Should save the state once with 'won' status
        expect(mockContext.globalState.update).toHaveBeenCalledTimes(1);
        const saveCall = mockContext.globalState.update.mock.calls[0];
        const deserializeResult = GameStateSerialization.deserialize(saveCall[1]);
        expect(deserializeResult.success).toBe(true);
        expect(deserializeResult.state?.gameState).toBe('won');
    });

    it('should detect lose condition', () => {
        // Create a full board with no possible moves
        const losingState: GameState = {
            board: [
                [2, 4, 2, 4],
                [4, 2, 4, 2],
                [2, 4, 2, 4],
                [4, 2, 4, 2]
            ],
            score: 1000,
            gameState: 'playing',
            moveCount: 50,
            startTime: Date.now()
        };

        controller.handleGameStateChange(losingState);

        // Should save the state once with 'lost' status
        expect(mockContext.globalState.update).toHaveBeenCalledTimes(1);
        const saveCall = mockContext.globalState.update.mock.calls[0];
        const deserializeResult = GameStateSerialization.deserialize(saveCall[1]);
        expect(deserializeResult.success).toBe(true);
        expect(deserializeResult.state?.gameState).toBe('lost');
    });

    it('should handle storage errors gracefully', () => {
        mockContext.globalState.update.mockImplementation(() => {
            throw new Error('Storage error');
        });

        const gameState: GameState = {
            board: [[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
            score: 25,
            gameState: 'playing',
            moveCount: 2,
            startTime: Date.now()
        };

        // Should not throw even if storage fails
        expect(() => {
            controller.saveGameState(gameState);
        }).not.toThrow();
    });

    it('should work without game view provider', () => {
        const controllerWithoutProvider = new GameController(mockContext);

        // Should not throw when starting new game without provider
        expect(() => {
            controllerWithoutProvider.startNewGame();
        }).not.toThrow();

        // Should still save to storage
        expect(mockContext.globalState.update).toHaveBeenCalled();
    });

    it('should handle gameMove message', () => {
        const controller = new GameController(mockContext, mockGameViewProvider);
        controller.startNewGame();
        
        // Clear previous calls
        vi.clearAllMocks();
        
        // Test valid move
        controller.handleMessage({ type: 'gameMove', direction: 'up' });
        
        // Should have called postMessage on view provider
        expect(mockGameViewProvider.postMessage).toHaveBeenCalled();
    });

    it('should reject invalid move directions', () => {
        const controller = new GameController(mockContext, mockGameViewProvider);
        controller.startNewGame();
        
        // Clear previous calls
        vi.clearAllMocks();
        
        // Test invalid move direction - should not crash
        expect(() => {
            controller.handleMessage({ type: 'gameMove', direction: 'invalid' });
        }).not.toThrow();
        
        // Should not post any messages for invalid moves
        expect(mockGameViewProvider.postMessage).not.toHaveBeenCalled();
    });

    it('should ignore moves when game is not in playing state', () => {
        const controller = new GameController(mockContext, mockGameViewProvider);
        controller.startNewGame();
        
        // Simulate game over state
        const gameOverState = {
            board: Array(4).fill(null).map(() => Array(4).fill(2)),
            score: 1000,
            gameState: 'lost' as const,
            moveCount: 50,
            startTime: Date.now()
        };
        
        controller.handleGameStateChange(gameOverState);
        
        // Clear previous calls
        vi.clearAllMocks();
        
        // Try to make a move
        controller.handleMessage({ type: 'gameMove', direction: 'up' });
        
        // Should not post any new messages since game is over
        expect(mockGameViewProvider.postMessage).not.toHaveBeenCalled();
    });

    it('should initialize with saved game state', () => {
        const gameState: GameState = {
            board: [[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
            score: 100,
            gameState: 'playing',
            moveCount: 5,
            startTime: Date.now()
        };

        const serializeResult = GameStateSerialization.serialize(gameState);
        mockContext.globalState.get.mockReturnValue(serializeResult.data);

        controller.initialize();

        expect(mockContext.globalState.get).toHaveBeenCalledWith('2048Game.gameState');
    });

    it('should initialize without saved game state', () => {
        mockContext.globalState.get.mockReturnValue(undefined);

        expect(() => {
            controller.initialize();
        }).not.toThrow();
    });

    it('should dispose and save current game state', () => {
        // Start a game first
        controller.startNewGame();
        
        // Clear previous calls
        vi.clearAllMocks();

        controller.dispose();

        // Should save the current state
        expect(mockContext.globalState.update).toHaveBeenCalledWith(
            '2048Game.gameState',
            expect.any(String)
        );
    });

    it('should handle disposal without active game', () => {
        expect(() => {
            controller.dispose();
        }).not.toThrow();

        // Should not try to save if no game is active
        expect(mockContext.globalState.update).not.toHaveBeenCalled();
    });

    it('should provide storage info', () => {
        mockContext.globalState.get.mockReturnValue('some-saved-data');

        const info = controller.getStorageInfo();

        expect(info).toEqual({
            hasStoredGame: true,
            storageKey: '2048Game.gameState'
        });
    });

    it('should handle invalid game state with detailed error', () => {
        const invalidState = {
            board: 'not-an-array',
            score: -100,
            gameState: 'invalid',
            moveCount: 'not-a-number',
            startTime: 'not-a-number'
        };

        expect(() => {
            controller.handleGameStateChange(invalidState as any);
        }).not.toThrow();

        // Should post error message
        expect(mockGameViewProvider.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'error',
                error: expect.objectContaining({
                    message: expect.any(String)
                })
            })
        );
    });

    it('should handle storage errors during save gracefully', () => {
        mockContext.globalState.update.mockImplementation(() => {
            throw new Error('Storage quota exceeded');
        });

        const gameState: GameState = {
            board: [[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
            score: 25,
            gameState: 'playing',
            moveCount: 2,
            startTime: Date.now()
        };

        expect(() => {
            controller.saveGameState(gameState);
        }).not.toThrow();
    });

    it('should handle storage errors during load gracefully', () => {
        mockContext.globalState.get.mockImplementation(() => {
            throw new Error('Storage access error');
        });

        const loadedState = controller.loadGameState();

        expect(loadedState).toBeNull();
        // Should clean up on error
        expect(mockContext.globalState.update).toHaveBeenCalledWith('2048Game.gameState', undefined);
    });
});