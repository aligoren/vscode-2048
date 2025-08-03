import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameEngine, GameState } from './gameEngine';

describe('GameEngine', () => {
    let gameEngine: GameEngine;

    beforeEach(() => {
        // Mock Math.random to make tests deterministic
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        gameEngine = new GameEngine();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Board Initialization', () => {
        it('should create a 4x4 board', () => {
            const board = gameEngine.board;
            expect(board).toHaveLength(4);
            board.forEach(row => {
                expect(row).toHaveLength(4);
            });
        });

        it('should initialize with exactly two tiles', () => {
            const board = gameEngine.board;
            let tileCount = 0;
            
            for (let row = 0; row < 4; row++) {
                for (let col = 0; col < 4; col++) {
                    if (board[row][col] !== 0) {
                        tileCount++;
                    }
                }
            }
            
            expect(tileCount).toBe(2);
        });

        it('should initialize tiles with values 2 or 4', () => {
            const board = gameEngine.board;
            
            for (let row = 0; row < 4; row++) {
                for (let col = 0; col < 4; col++) {
                    const value = board[row][col];
                    if (value !== 0) {
                        expect([2, 4]).toContain(value);
                    }
                }
            }
        });

        it('should initialize with score 0', () => {
            expect(gameEngine.score).toBe(0);
        });

        it('should initialize with playing state', () => {
            expect(gameEngine.gameState).toBe('playing');
        });

        it('should initialize with move count 0', () => {
            expect(gameEngine.moveCount).toBe(0);
        });

        it('should set start time on initialization', () => {
            const now = Date.now();
            const startTime = gameEngine.startTime;
            expect(startTime).toBeGreaterThanOrEqual(now - 100); // Allow for small time difference
            expect(startTime).toBeLessThanOrEqual(now + 100);
        });
    });

    describe('addRandomTile', () => {
        it('should add a tile with value 2 when random is < 0.9', () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.5); // < 0.9, should be 2
            
            // Create empty board
            const emptyEngine = new GameEngine();
            emptyEngine['_board'] = Array(4).fill(null).map(() => Array(4).fill(0));
            
            const result = emptyEngine.addRandomTile();
            
            expect(result).toBe(true);
            
            // Find the added tile
            let foundTile = false;
            for (let row = 0; row < 4; row++) {
                for (let col = 0; col < 4; col++) {
                    if (emptyEngine.board[row][col] === 2) {
                        foundTile = true;
                        break;
                    }
                }
            }
            expect(foundTile).toBe(true);
        });

        it('should add a tile with value 4 when random is >= 0.9', () => {
            // Create empty board first
            const emptyEngine = new GameEngine();
            emptyEngine['_board'] = Array(4).fill(null).map(() => Array(4).fill(0));
            
            vi.spyOn(Math, 'random')
                .mockReturnValueOnce(0) // First empty cell (position 0)
                .mockReturnValueOnce(0.95); // >= 0.9, should be 4
            
            const result = emptyEngine.addRandomTile();
            
            expect(result).toBe(true);
            expect(emptyEngine.board[0][0]).toBe(4);
        });

        it('should return false when no empty cells available', () => {
            // Fill the board completely
            gameEngine['_board'] = Array(4).fill(null).map(() => Array(4).fill(2));
            
            const result = gameEngine.addRandomTile();
            expect(result).toBe(false);
        });

        it('should place tile in random empty cell', () => {
            vi.spyOn(Math, 'random')
                .mockReturnValueOnce(0.5) // Value 2
                .mockReturnValueOnce(0.5); // Middle of empty cells array
            
            // Create board with specific empty cells
            gameEngine['_board'] = [
                [2, 0, 0, 2],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [2, 0, 0, 2]
            ];
            
            const result = gameEngine.addRandomTile();
            expect(result).toBe(true);
            
            // Should have one more non-zero tile
            let tileCount = 0;
            for (let row = 0; row < 4; row++) {
                for (let col = 0; col < 4; col++) {
                    if (gameEngine.board[row][col] !== 0) {
                        tileCount++;
                    }
                }
            }
            expect(tileCount).toBe(5); // 4 original + 1 new
        });
    });

    describe('Board Access', () => {
        it('should return a copy of the board to prevent external modification', () => {
            const board1 = gameEngine.board;
            const board2 = gameEngine.board;
            
            // Modify the returned board
            board1[0][0] = 999;
            
            // Original board should be unchanged
            expect(board2[0][0]).not.toBe(999);
            expect(gameEngine.board[0][0]).not.toBe(999);
        });
    });

    describe('Game State Management', () => {
        it('should return current game state', () => {
            const state = gameEngine.getGameState();
            
            expect(state).toHaveProperty('board');
            expect(state).toHaveProperty('score');
            expect(state).toHaveProperty('gameState');
            expect(state).toHaveProperty('moveCount');
            expect(state).toHaveProperty('startTime');
            
            expect(state.board).toHaveLength(4);
            expect(state.score).toBe(0);
            expect(state.gameState).toBe('playing');
            expect(state.moveCount).toBe(0);
            expect(typeof state.startTime).toBe('number');
        });

        it('should load game state correctly', () => {
            const testState: GameState = {
                board: [
                    [2, 4, 8, 16],
                    [32, 64, 128, 256],
                    [512, 1024, 2048, 0],
                    [0, 0, 0, 0]
                ],
                score: 12345,
                gameState: 'won',
                moveCount: 100,
                startTime: 1234567890
            };
            
            gameEngine.loadGameState(testState);
            
            expect(gameEngine.board).toEqual(testState.board);
            expect(gameEngine.score).toBe(testState.score);
            expect(gameEngine.gameState).toBe(testState.gameState);
            expect(gameEngine.moveCount).toBe(testState.moveCount);
            expect(gameEngine.startTime).toBe(testState.startTime);
        });

        it('should create independent copies when loading state', () => {
            const testState: GameState = {
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
            
            gameEngine.loadGameState(testState);
            
            // Modify the original state
            testState.board[0][0] = 999;
            testState.score = 999;
            
            // Game engine should not be affected
            expect(gameEngine.board[0][0]).toBe(2);
            expect(gameEngine.score).toBe(100);
        });
    });

    describe('Game Reinitialization', () => {
        it('should reset all properties when initializing new game', () => {
            // Modify the game state
            gameEngine['_score'] = 1000;
            gameEngine['_gameState'] = 'won';
            gameEngine['_moveCount'] = 50;
            
            // Initialize new game
            gameEngine.initializeGame();
            
            expect(gameEngine.score).toBe(0);
            expect(gameEngine.gameState).toBe('playing');
            expect(gameEngine.moveCount).toBe(0);
            
            // Should have exactly 2 tiles again
            let tileCount = 0;
            const board = gameEngine.board;
            for (let row = 0; row < 4; row++) {
                for (let col = 0; col < 4; col++) {
                    if (board[row][col] !== 0) {
                        tileCount++;
                    }
                }
            }
            expect(tileCount).toBe(2);
        });
    });

    describe('Tile Movement and Merging', () => {
        beforeEach(() => {
            // Create a clean engine for movement tests
            gameEngine = new GameEngine();
            // Clear the board for controlled testing
            gameEngine['_board'] = Array(4).fill(null).map(() => Array(4).fill(0));
            gameEngine['_score'] = 0;
        });

        describe('Move Left', () => {
            it('should slide tiles to the left', () => {
                gameEngine['_board'] = [
                    [0, 2, 0, 4],
                    [0, 0, 8, 0],
                    [2, 0, 0, 0],
                    [0, 0, 0, 16]
                ];

                vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);
                const moved = gameEngine.move('left');

                expect(moved).toBe(true);
                expect(gameEngine.board).toEqual([
                    [2, 4, 0, 0],
                    [8, 0, 0, 0],
                    [2, 0, 0, 0],
                    [16, 0, 0, 0]
                ]);
            });

            it('should merge equal adjacent tiles when moving left', () => {
                gameEngine['_board'] = [
                    [2, 2, 4, 4],
                    [8, 8, 0, 0],
                    [2, 4, 2, 4],
                    [0, 0, 0, 0]
                ];

                vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);
                const moved = gameEngine.move('left');

                expect(moved).toBe(true);
                expect(gameEngine.board).toEqual([
                    [4, 8, 0, 0],
                    [16, 0, 0, 0],
                    [2, 4, 2, 4],
                    [0, 0, 0, 0]
                ]);
                expect(gameEngine.score).toBe(28); // 4 + 8 + 16 = 28
            });

            it('should not merge tiles that have already merged in the same move', () => {
                gameEngine['_board'] = [
                    [2, 2, 2, 2],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ];

                vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);
                const moved = gameEngine.move('left');

                expect(moved).toBe(true);
                expect(gameEngine.board).toEqual([
                    [4, 4, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ]);
                expect(gameEngine.score).toBe(8); // 4 + 4 = 8
            });
        });

        describe('Move Right', () => {
            it('should slide tiles to the right', () => {
                gameEngine['_board'] = [
                    [2, 0, 4, 0],
                    [0, 8, 0, 0],
                    [0, 0, 0, 2],
                    [16, 0, 0, 0]
                ];

                vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);
                const moved = gameEngine.move('right');

                expect(moved).toBe(true);
                expect(gameEngine.board).toEqual([
                    [0, 0, 2, 4],
                    [0, 0, 0, 8],
                    [0, 0, 0, 2],
                    [0, 0, 0, 16]
                ]);
            });

            it('should merge equal adjacent tiles when moving right', () => {
                gameEngine['_board'] = [
                    [2, 2, 4, 4],
                    [0, 0, 8, 8],
                    [2, 4, 2, 4],
                    [0, 0, 0, 0]
                ];

                vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);
                const moved = gameEngine.move('right');

                expect(moved).toBe(true);
                expect(gameEngine.board).toEqual([
                    [0, 0, 4, 8],
                    [0, 0, 0, 16],
                    [2, 4, 2, 4],
                    [0, 0, 0, 0]
                ]);
                expect(gameEngine.score).toBe(28); // 4 + 8 + 16 = 28
            });
        });

        describe('Move Up', () => {
            it('should slide tiles up', () => {
                gameEngine['_board'] = [
                    [0, 0, 2, 0],
                    [2, 8, 0, 16],
                    [0, 0, 4, 0],
                    [4, 0, 0, 0]
                ];

                vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);
                const moved = gameEngine.move('up');

                expect(moved).toBe(true);
                expect(gameEngine.board).toEqual([
                    [2, 8, 2, 16],
                    [4, 0, 4, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ]);
            });

            it('should merge equal adjacent tiles when moving up', () => {
                gameEngine['_board'] = [
                    [2, 8, 2, 0],
                    [2, 8, 4, 0],
                    [4, 0, 2, 0],
                    [4, 0, 4, 0]
                ];

                vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);
                const moved = gameEngine.move('up');

                expect(moved).toBe(true);
                expect(gameEngine.board).toEqual([
                    [4, 16, 2, 0],
                    [8, 0, 4, 0],
                    [0, 0, 2, 0],
                    [0, 0, 4, 0]
                ]);
                expect(gameEngine.score).toBe(28); // 4 + 16 + 8 = 28
            });
        });

        describe('Move Down', () => {
            it('should slide tiles down', () => {
                gameEngine['_board'] = [
                    [2, 0, 0, 16],
                    [0, 8, 4, 0],
                    [4, 0, 0, 0],
                    [0, 0, 2, 0]
                ];

                vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);
                const moved = gameEngine.move('down');

                expect(moved).toBe(true);
                expect(gameEngine.board).toEqual([
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [2, 0, 4, 0],
                    [4, 8, 2, 16]
                ]);
            });

            it('should merge equal adjacent tiles when moving down', () => {
                gameEngine['_board'] = [
                    [2, 0, 4, 4],
                    [2, 0, 4, 4],
                    [4, 8, 2, 0],
                    [4, 8, 2, 0]
                ];

                vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);
                const moved = gameEngine.move('down');

                expect(moved).toBe(true);
                expect(gameEngine.board).toEqual([
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [4, 0, 8, 0],
                    [8, 16, 4, 8]
                ]);
                expect(gameEngine.score).toBe(48); // 4 + 8 + 16 + 8 + 8 + 4 = 48
            });
        });

        describe('Move Validation', () => {
            it('should return false when no tiles can move', () => {
                gameEngine['_board'] = [
                    [2, 4, 2, 4],
                    [4, 2, 4, 2],
                    [2, 4, 2, 4],
                    [4, 2, 4, 2]
                ];

                const moved = gameEngine.move('left');
                expect(moved).toBe(false);
                expect(gameEngine.moveCount).toBe(0); // Move count should not increment
            });

            it('should increment move count when tiles move', () => {
                gameEngine['_board'] = [
                    [2, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ];

                vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);
                const initialMoveCount = gameEngine.moveCount;
                
                gameEngine.move('right');
                
                expect(gameEngine.moveCount).toBe(initialMoveCount + 1);
            });

            it('should add random tile after successful move', () => {
                gameEngine['_board'] = [
                    [2, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ];

                const addRandomTileSpy = vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);
                
                gameEngine.move('right');
                
                expect(addRandomTileSpy).toHaveBeenCalledOnce();
            });

            it('should not add random tile when no move occurs', () => {
                gameEngine['_board'] = [
                    [2, 4, 2, 4],
                    [4, 2, 4, 2],
                    [2, 4, 2, 4],
                    [4, 2, 4, 2]
                ];

                const addRandomTileSpy = vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);
                
                gameEngine.move('left');
                
                expect(addRandomTileSpy).not.toHaveBeenCalled();
            });
        });

        describe('Score Calculation', () => {
            it('should add merged tile values to score', () => {
                gameEngine['_board'] = [
                    [2, 2, 4, 4],
                    [8, 8, 16, 16],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ];

                vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);
                gameEngine.move('left');

                // Merges: 2+2=4, 4+4=8, 8+8=16, 16+16=32
                // Score: 4 + 8 + 16 + 32 = 60
                expect(gameEngine.score).toBe(60);
            });

            it('should accumulate score across multiple moves', () => {
                gameEngine['_board'] = [
                    [2, 2, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ];

                vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);
                
                gameEngine.move('left'); // Score: 4
                expect(gameEngine.score).toBe(4);

                gameEngine['_board'][0] = [4, 4, 0, 0];
                gameEngine.move('left'); // Score: 4 + 8 = 12
                expect(gameEngine.score).toBe(12);
            });
        });
    });

    describe('Game State Management and Win/Lose Detection', () => {
        beforeEach(() => {
            gameEngine = new GameEngine();
            gameEngine['_board'] = Array(4).fill(null).map(() => Array(4).fill(0));
            gameEngine['_score'] = 0;
            gameEngine['_gameState'] = 'playing';
        });

        describe('Available Moves Detection', () => {
            it('should return true when there are empty cells', () => {
                gameEngine['_board'] = [
                    [2, 4, 8, 16],
                    [4, 8, 16, 32],
                    [8, 16, 32, 64],
                    [16, 32, 64, 0] // One empty cell
                ];

                expect(gameEngine.hasAvailableMoves()).toBe(true);
            });

            it('should return true when horizontal merges are possible', () => {
                gameEngine['_board'] = [
                    [2, 4, 8, 16],
                    [4, 8, 16, 32],
                    [8, 16, 32, 64],
                    [16, 32, 32, 128] // Adjacent 32s can merge
                ];

                expect(gameEngine.hasAvailableMoves()).toBe(true);
            });

            it('should return true when vertical merges are possible', () => {
                gameEngine['_board'] = [
                    [2, 4, 8, 16],
                    [4, 8, 16, 32],
                    [8, 16, 32, 32], // 32 above and below can merge
                    [16, 32, 64, 32]
                ];

                expect(gameEngine.hasAvailableMoves()).toBe(true);
            });

            it('should return false when no moves are available', () => {
                gameEngine['_board'] = [
                    [2, 4, 8, 16],
                    [4, 8, 16, 32],
                    [8, 16, 32, 64],
                    [16, 32, 64, 128]
                ];

                expect(gameEngine.hasAvailableMoves()).toBe(false);
            });

            it('should return true for a mostly full board with one merge possibility', () => {
                gameEngine['_board'] = [
                    [2, 4, 8, 16],
                    [4, 8, 16, 32],
                    [8, 16, 32, 64],
                    [16, 32, 64, 64] // Last two can merge
                ];

                expect(gameEngine.hasAvailableMoves()).toBe(true);
            });
        });

        describe('Win Condition Detection', () => {
            it('should return true when 2048 tile exists', () => {
                gameEngine['_board'] = [
                    [2, 4, 8, 16],
                    [4, 8, 16, 32],
                    [8, 16, 2048, 64], // 2048 tile present
                    [16, 32, 64, 128]
                ];

                expect(gameEngine.hasWon()).toBe(true);
            });

            it('should return false when no 2048 tile exists', () => {
                gameEngine['_board'] = [
                    [2, 4, 8, 16],
                    [4, 8, 16, 32],
                    [8, 16, 1024, 64], // Highest is 1024
                    [16, 32, 64, 128]
                ];

                expect(gameEngine.hasWon()).toBe(false);
            });

            it('should return true when multiple 2048 tiles exist', () => {
                gameEngine['_board'] = [
                    [2048, 4, 8, 16],
                    [4, 8, 16, 32],
                    [8, 16, 2048, 64], // Two 2048 tiles
                    [16, 32, 64, 128]
                ];

                expect(gameEngine.hasWon()).toBe(true);
            });
        });

        describe('Game Over Detection', () => {
            it('should return true when no moves are available', () => {
                gameEngine['_board'] = [
                    [2, 4, 8, 16],
                    [4, 8, 16, 32],
                    [8, 16, 32, 64],
                    [16, 32, 64, 128]
                ];

                expect(gameEngine.isGameOver()).toBe(true);
            });

            it('should return false when moves are still available', () => {
                gameEngine['_board'] = [
                    [2, 4, 8, 16],
                    [4, 8, 16, 32],
                    [8, 16, 32, 64],
                    [16, 32, 64, 0] // Empty cell available
                ];

                expect(gameEngine.isGameOver()).toBe(false);
            });
        });

        describe('Game State Updates', () => {
            it('should set game state to won when 2048 is reached', () => {
                gameEngine['_board'] = [
                    [1024, 1024, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ];

                vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);
                gameEngine.move('left'); // This should create 2048

                expect(gameEngine.gameState).toBe('won');
            });

            it('should set game state to lost when no moves are available', () => {
                // Create a board with no possible moves
                gameEngine['_board'] = [
                    [2, 4, 8, 16],
                    [4, 8, 16, 32],
                    [8, 16, 32, 64],
                    [16, 32, 64, 128]
                ];

                // Directly call updateGameState to test the logic
                gameEngine.updateGameState();

                expect(gameEngine.gameState).toBe('lost');
            });

            it('should remain playing when game continues', () => {
                gameEngine['_board'] = [
                    [2, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ];

                vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);
                gameEngine.move('left');

                expect(gameEngine.gameState).toBe('playing');
            });

            it('should not change state from won back to playing', () => {
                gameEngine['_gameState'] = 'won';
                gameEngine['_board'] = [
                    [2, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ];

                gameEngine.updateGameState();

                expect(gameEngine.gameState).toBe('won');
            });

            it('should not change state from lost back to playing', () => {
                gameEngine['_gameState'] = 'lost';
                gameEngine['_board'] = [
                    [2, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ];

                gameEngine.updateGameState();

                expect(gameEngine.gameState).toBe('lost');
            });
        });

        describe('Utility Methods', () => {
            it('should return the highest tile value', () => {
                gameEngine['_board'] = [
                    [2, 4, 8, 16],
                    [4, 8, 16, 32],
                    [8, 16, 1024, 64], // 1024 is highest
                    [16, 32, 64, 128]
                ];

                expect(gameEngine.getHighestTile()).toBe(1024);
            });

            it('should return 0 for empty board', () => {
                gameEngine['_board'] = Array(4).fill(null).map(() => Array(4).fill(0));

                expect(gameEngine.getHighestTile()).toBe(0);
            });

            it('should detect if specific tile value exists', () => {
                gameEngine['_board'] = [
                    [2, 4, 8, 16],
                    [4, 8, 16, 32],
                    [8, 16, 512, 64],
                    [16, 32, 64, 128]
                ];

                expect(gameEngine.hasTile(512)).toBe(true);
                expect(gameEngine.hasTile(256)).toBe(false);
                expect(gameEngine.hasTile(2)).toBe(true);
            });

            it('should return false for tile value that does not exist', () => {
                gameEngine['_board'] = Array(4).fill(null).map(() => Array(4).fill(0));

                expect(gameEngine.hasTile(2)).toBe(false);
                expect(gameEngine.hasTile(2048)).toBe(false);
            });
        });

        describe('Integration with Move System', () => {
            it('should update game state after each move', () => {
                gameEngine['_board'] = [
                    [1024, 1024, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ];

                const updateGameStateSpy = vi.spyOn(gameEngine, 'updateGameState');
                vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);

                gameEngine.move('left');

                expect(updateGameStateSpy).toHaveBeenCalledOnce();
            });

            it('should not update game state when no move occurs', () => {
                gameEngine['_board'] = [
                    [2, 4, 8, 16],
                    [4, 8, 16, 32],
                    [8, 16, 32, 64],
                    [16, 32, 64, 128]
                ];

                const updateGameStateSpy = vi.spyOn(gameEngine, 'updateGameState');

                gameEngine.move('left'); // No move possible

                expect(updateGameStateSpy).not.toHaveBeenCalled();
            });
        });
    });

    describe('Edge Cases and Complex Scenarios', () => {
        beforeEach(() => {
            gameEngine = new GameEngine();
            gameEngine['_board'] = Array(4).fill(null).map(() => Array(4).fill(0));
            gameEngine['_score'] = 0;
        });

        describe('Complex Merging Scenarios', () => {
            it('should handle triple merge correctly (only merge first two)', () => {
                gameEngine['_board'] = [
                    [2, 2, 2, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ];

                vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);
                gameEngine.move('left');

                expect(gameEngine.board[0]).toEqual([4, 2, 0, 0]);
                expect(gameEngine.score).toBe(4);
            });

            it('should handle quadruple merge correctly (two separate merges)', () => {
                gameEngine['_board'] = [
                    [4, 4, 4, 4],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ];

                vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);
                gameEngine.move('left');

                expect(gameEngine.board[0]).toEqual([8, 8, 0, 0]);
                expect(gameEngine.score).toBe(16); // 8 + 8
            });

            it('should handle mixed values with gaps correctly', () => {
                gameEngine['_board'] = [
                    [0, 2, 0, 2],
                    [4, 0, 4, 0],
                    [0, 8, 0, 8],
                    [16, 0, 16, 0]
                ];

                vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);
                gameEngine.move('left');

                expect(gameEngine.board).toEqual([
                    [4, 0, 0, 0],
                    [8, 0, 0, 0],
                    [16, 0, 0, 0],
                    [32, 0, 0, 0]
                ]);
                expect(gameEngine.score).toBe(60); // 4 + 8 + 16 + 32
            });

            it('should handle large tile merges correctly', () => {
                gameEngine['_board'] = [
                    [1024, 1024, 512, 512],
                    [256, 256, 128, 128],
                    [64, 64, 32, 32],
                    [16, 16, 8, 8]
                ];

                vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);
                gameEngine.move('left');

                expect(gameEngine.board).toEqual([
                    [2048, 1024, 0, 0],
                    [512, 256, 0, 0],
                    [128, 64, 0, 0],
                    [32, 16, 0, 0]
                ]);
                expect(gameEngine.score).toBe(4080); // 2048 + 512 + 256 + 128 + 64 + 32 + 16 + 8 + 16
                expect(gameEngine.gameState).toBe('won'); // Should win with 2048
            });
        });

        describe('Boundary Conditions', () => {
            it('should handle empty board moves correctly', () => {
                gameEngine['_board'] = Array(4).fill(null).map(() => Array(4).fill(0));

                const moved = gameEngine.move('left');
                expect(moved).toBe(false);
                expect(gameEngine.moveCount).toBe(0);
            });

            it('should handle single tile moves in all directions', () => {
                gameEngine['_board'] = [
                    [0, 0, 2, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ];

                vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);

                // Move left
                gameEngine.move('left');
                expect(gameEngine.board[0]).toEqual([2, 0, 0, 0]);

                // Reset and move right
                gameEngine['_board'][0] = [0, 0, 2, 0];
                gameEngine.move('right');
                expect(gameEngine.board[0]).toEqual([0, 0, 0, 2]);

                // Reset and move up (already at top)
                gameEngine['_board'] = [
                    [0, 0, 2, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ];
                const upMoved = gameEngine.move('up');
                expect(upMoved).toBe(false); // No movement possible

                // Reset and move down
                gameEngine['_board'] = [
                    [0, 0, 2, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ];
                gameEngine.move('down');
                expect(gameEngine.board[3]).toEqual([0, 0, 2, 0]);
            });

            it('should handle full board with no merges correctly', () => {
                gameEngine['_board'] = [
                    [2, 4, 2, 4],
                    [4, 2, 4, 2],
                    [2, 4, 2, 4],
                    [4, 2, 4, 2]
                ];

                expect(gameEngine.hasAvailableMoves()).toBe(false);
                expect(gameEngine.isGameOver()).toBe(true);

                const moved = gameEngine.move('left');
                expect(moved).toBe(false);
                expect(gameEngine.moveCount).toBe(0);
            });
        });

        describe('Random Tile Generation Edge Cases', () => {
            it('should handle addRandomTile when board is nearly full', () => {
                // Fill board except one cell
                gameEngine['_board'] = [
                    [2, 4, 8, 16],
                    [4, 8, 16, 32],
                    [8, 16, 32, 64],
                    [16, 32, 64, 0] // Only one empty cell
                ];

                vi.spyOn(Math, 'random').mockReturnValue(0.5); // Should place 2
                const result = gameEngine.addRandomTile();

                expect(result).toBe(true);
                expect(gameEngine.board[3][3]).toBe(2);
            });

            it('should handle multiple addRandomTile calls on full board', () => {
                // Fill board completely
                gameEngine['_board'] = Array(4).fill(null).map(() => Array(4).fill(2));

                const result1 = gameEngine.addRandomTile();
                const result2 = gameEngine.addRandomTile();

                expect(result1).toBe(false);
                expect(result2).toBe(false);
            });

            it('should maintain proper tile distribution over multiple additions', () => {
                gameEngine['_board'] = Array(4).fill(null).map(() => Array(4).fill(0));
                
                // Mock random to always return 0.5 (should be 2)
                vi.spyOn(Math, 'random').mockReturnValue(0.5);

                const results = [];
                for (let i = 0; i < 16; i++) {
                    results.push(gameEngine.addRandomTile());
                }

                // All should succeed until board is full
                expect(results.slice(0, 16).every(r => r === true)).toBe(true);

                // Count tiles
                let tileCount = 0;
                for (let row = 0; row < 4; row++) {
                    for (let col = 0; col < 4; col++) {
                        if (gameEngine.board[row][col] !== 0) {
                            tileCount++;
                        }
                    }
                }
                expect(tileCount).toBe(16);
            });
        });

        describe('Game State Persistence Edge Cases', () => {
            it('should handle loading state with invalid board dimensions', () => {
                const invalidState: GameState = {
                    board: [[2, 4], [8, 16]], // 2x2 instead of 4x4
                    score: 100,
                    gameState: 'playing',
                    moveCount: 5,
                    startTime: Date.now()
                };

                gameEngine.loadGameState(invalidState);
                
                // Board should be loaded as-is (the game engine doesn't validate dimensions)
                expect(gameEngine.board).toEqual([[2, 4], [8, 16]]);
            });

            it('should handle state serialization with extreme values', () => {
                gameEngine['_board'] = [
                    [65536, 32768, 16384, 8192],
                    [4096, 2048, 1024, 512],
                    [256, 128, 64, 32],
                    [16, 8, 4, 2]
                ];
                gameEngine['_score'] = 999999;
                gameEngine['_moveCount'] = 10000;
                gameEngine['_gameState'] = 'won';

                const state = gameEngine.getGameState();
                
                expect(state.board[0][0]).toBe(65536);
                expect(state.score).toBe(999999);
                expect(state.moveCount).toBe(10000);
                expect(state.gameState).toBe('won');
            });
        });

        describe('Win Condition Edge Cases', () => {
            it('should detect win immediately when 2048 is created', () => {
                gameEngine['_board'] = [
                    [1024, 1024, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ];

                vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);
                gameEngine.move('left');

                expect(gameEngine.gameState).toBe('won');
                expect(gameEngine.hasTile(2048)).toBe(true);
            });

            it('should handle multiple 2048 tiles correctly', () => {
                gameEngine['_board'] = [
                    [2048, 2048, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ];

                expect(gameEngine.hasWon()).toBe(true);
                
                // Should still be able to merge 2048 tiles
                vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);
                gameEngine.move('left');
                
                expect(gameEngine.hasTile(4096)).toBe(true);
                expect(gameEngine.gameState).toBe('playing'); // Game state should be playing initially
            });

            it('should handle tiles beyond 2048 correctly', () => {
                gameEngine['_board'] = [
                    [4096, 8192, 16384, 32768],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ];

                expect(gameEngine.getHighestTile()).toBe(32768);
                expect(gameEngine.hasTile(4096)).toBe(true);
                expect(gameEngine.hasTile(65536)).toBe(false);
            });
        });

        describe('Performance and Memory Edge Cases', () => {
            it('should handle rapid successive moves efficiently', () => {
                gameEngine['_board'] = [
                    [2, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ];

                vi.spyOn(gameEngine, 'addRandomTile').mockReturnValue(true);

                const startTime = Date.now();
                
                // Perform 100 moves rapidly
                for (let i = 0; i < 100; i++) {
                    gameEngine.move(i % 2 === 0 ? 'left' : 'right');
                }

                const endTime = Date.now();
                
                // Should complete within reasonable time (less than 100ms)
                expect(endTime - startTime).toBeLessThan(100);
                expect(gameEngine.moveCount).toBeGreaterThanOrEqual(99); // Some moves might not be valid
            });

            it('should maintain board integrity after many operations', () => {
                const initialBoard = [
                    [2, 4, 8, 16],
                    [4, 8, 16, 32],
                    [8, 16, 32, 64],
                    [16, 32, 64, 128]
                ];

                gameEngine['_board'] = initialBoard.map(row => [...row]);

                // Perform many operations that shouldn't change the board
                for (let i = 0; i < 50; i++) {
                    gameEngine.move('left'); // No moves possible
                    gameEngine.getGameState();
                    gameEngine.hasAvailableMoves();
                    gameEngine.isGameOver();
                    gameEngine.hasWon();
                    gameEngine.getHighestTile();
                }

                // Board should remain unchanged
                expect(gameEngine.board).toEqual(initialBoard);
                expect(gameEngine.moveCount).toBe(0); // No actual moves occurred
            });
        });

        describe('Array Equality Helper', () => {
            it('should correctly identify equal arrays', () => {
                const arr1 = [1, 2, 3, 4];
                const arr2 = [1, 2, 3, 4];
                
                // Access private method for testing
                const result = gameEngine['arraysEqual'](arr1, arr2);
                expect(result).toBe(true);
            });

            it('should correctly identify unequal arrays', () => {
                const arr1 = [1, 2, 3, 4];
                const arr2 = [1, 2, 3, 5];
                
                const result = gameEngine['arraysEqual'](arr1, arr2);
                expect(result).toBe(false);
            });

            it('should handle arrays of different lengths', () => {
                const arr1 = [1, 2, 3];
                const arr2 = [1, 2, 3, 4];
                
                const result = gameEngine['arraysEqual'](arr1, arr2);
                expect(result).toBe(false);
            });

            it('should handle empty arrays', () => {
                const arr1: number[] = [];
                const arr2: number[] = [];
                
                const result = gameEngine['arraysEqual'](arr1, arr2);
                expect(result).toBe(true);
            });
        });

        describe('Slide and Merge Row Logic', () => {
            it('should handle row with all zeros', () => {
                const row = [0, 0, 0, 0];
                const result = gameEngine['slideAndMergeRow'](row);
                
                expect(result).toEqual([0, 0, 0, 0]);
                expect(gameEngine.score).toBe(0); // No score change
            });

            it('should handle row with single non-zero value', () => {
                const row = [0, 0, 8, 0];
                const result = gameEngine['slideAndMergeRow'](row);
                
                expect(result).toEqual([8, 0, 0, 0]);
                expect(gameEngine.score).toBe(0); // No merges, no score change
            });

            it('should handle row with no possible merges', () => {
                const row = [2, 4, 8, 16];
                const result = gameEngine['slideAndMergeRow'](row);
                
                expect(result).toEqual([2, 4, 8, 16]);
                expect(gameEngine.score).toBe(0); // No merges, no score change
            });

            it('should handle row with all same values', () => {
                gameEngine['_score'] = 0; // Reset score
                const row = [4, 4, 4, 4];
                const result = gameEngine['slideAndMergeRow'](row);
                
                expect(result).toEqual([8, 8, 0, 0]);
                expect(gameEngine.score).toBe(16); // 8 + 8
            });
        });
    });});
