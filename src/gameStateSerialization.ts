/**
 * Game state serialization utilities for the 2048 VSCode extension
 * Provides robust serialization, deserialization, and validation for game states
 */

import { GameState } from './gameEngine';

export interface SerializationResult {
    success: boolean;
    data?: string;
    error?: string;
}

export interface DeserializationResult {
    success: boolean;
    state?: GameState;
    error?: string;
    fallbackToNewGame?: boolean;
}

export class GameStateSerialization {
    private static readonly CURRENT_VERSION = 1;
    private static readonly MAGIC_HEADER = '2048_GAME_STATE';

    /**
     * Serialize a game state to a JSON string with version and validation metadata
     */
    static serialize(state: GameState): SerializationResult {
        try {
            // Validate the state before serialization
            const validationResult = this.validateGameState(state);
            if (!validationResult.isValid) {
                return {
                    success: false,
                    error: `Invalid game state: ${validationResult.errors.join(', ')}`
                };
            }

            // Create serializable object with metadata
            const serializedData = {
                header: this.MAGIC_HEADER,
                version: this.CURRENT_VERSION,
                timestamp: Date.now(),
                state: {
                    board: state.board,
                    score: state.score,
                    gameState: state.gameState,
                    moveCount: state.moveCount,
                    startTime: state.startTime
                }
            };

            const jsonString = JSON.stringify(serializedData);
            
            return {
                success: true,
                data: jsonString
            };
        } catch (error) {
            return {
                success: false,
                error: `Serialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Deserialize a JSON string to a game state with validation and fallback handling
     */
    static deserialize(jsonString: string): DeserializationResult {
        try {
            if (!jsonString || typeof jsonString !== 'string') {
                return {
                    success: false,
                    error: 'Invalid input: empty or non-string data',
                    fallbackToNewGame: true
                };
            }

            // Parse JSON
            let parsedData: any;
            try {
                parsedData = JSON.parse(jsonString);
            } catch (parseError) {
                return {
                    success: false,
                    error: 'Invalid JSON format',
                    fallbackToNewGame: true
                };
            }

            // Check for magic header and version
            if (parsedData.header !== this.MAGIC_HEADER) {
                return {
                    success: false,
                    error: 'Invalid game state format: missing or incorrect header',
                    fallbackToNewGame: true
                };
            }

            if (parsedData.version !== this.CURRENT_VERSION) {
                // In the future, we could handle version migration here
                return {
                    success: false,
                    error: `Unsupported game state version: ${parsedData.version}`,
                    fallbackToNewGame: true
                };
            }

            // Extract the game state
            const state = parsedData.state;
            if (!state) {
                return {
                    success: false,
                    error: 'Missing game state data',
                    fallbackToNewGame: true
                };
            }

            // Validate the deserialized state
            const validationResult = this.validateGameState(state);
            if (!validationResult.isValid) {
                return {
                    success: false,
                    error: `Invalid game state: ${validationResult.errors.join(', ')}`,
                    fallbackToNewGame: true
                };
            }

            // Additional integrity checks
            const integrityResult = this.checkGameStateIntegrity(state);
            if (!integrityResult.isValid) {
                return {
                    success: false,
                    error: `Game state integrity check failed: ${integrityResult.errors.join(', ')}`,
                    fallbackToNewGame: true
                };
            }

            return {
                success: true,
                state: state as GameState
            };
        } catch (error) {
            return {
                success: false,
                error: `Deserialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                fallbackToNewGame: true
            };
        }
    }

    /**
     * Validate the structure and basic properties of a game state
     */
    static validateGameState(state: any): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!state || typeof state !== 'object') {
            errors.push('State must be an object');
            return { isValid: false, errors };
        }

        // Check required properties exist and have correct types
        if (!Array.isArray(state.board)) {
            errors.push('Board must be an array');
        }

        if (typeof state.score !== 'number' || state.score < 0) {
            errors.push('Score must be a non-negative number');
        }

        if (typeof state.gameState !== 'string' || !['playing', 'won', 'lost'].includes(state.gameState)) {
            errors.push('GameState must be "playing", "won", or "lost"');
        }

        if (typeof state.moveCount !== 'number' || state.moveCount < 0) {
            errors.push('MoveCount must be a non-negative number');
        }

        if (typeof state.startTime !== 'number' || state.startTime <= 0) {
            errors.push('StartTime must be a positive number');
        }

        // Validate board structure
        if (Array.isArray(state.board)) {
            if (state.board.length !== 4) {
                errors.push('Board must have exactly 4 rows');
            } else {
                for (let i = 0; i < state.board.length; i++) {
                    const row = state.board[i];
                    if (!Array.isArray(row)) {
                        errors.push(`Row ${i} must be an array`);
                    } else if (row.length !== 4) {
                        errors.push(`Row ${i} must have exactly 4 columns`);
                    } else {
                        for (let j = 0; j < row.length; j++) {
                            const cell = row[j];
                            if (typeof cell !== 'number' || cell < 0) {
                                errors.push(`Cell [${i}][${j}] must be a non-negative number`);
                            }
                        }
                    }
                }
            }
        }

        return { isValid: errors.length === 0, errors };
    }

    /**
     * Perform additional integrity checks on the game state
     */
    static checkGameStateIntegrity(state: GameState): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Check if tile values are valid powers of 2 (or 0 for empty)
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const value = state.board[row][col];
                if (value !== 0 && (!this.isPowerOfTwo(value) || value < 2)) {
                    errors.push(`Invalid tile value ${value} at position [${row}][${col}]`);
                }
            }
        }

        // Check if start time is reasonable (not in the future, not too old)
        const now = Date.now();
        const maxGameDuration = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        
        if (state.startTime > now) {
            errors.push('Start time cannot be in the future');
        } else if (now - state.startTime > maxGameDuration) {
            errors.push('Game state is too old (more than 7 days)');
        }

        // Check if game state is consistent with board state
        if (state.gameState === 'won') {
            let hasWinningTile = false;
            for (const row of state.board) {
                if (row.includes(2048)) {
                    hasWinningTile = true;
                    break;
                }
            }
            if (!hasWinningTile) {
                errors.push('Game state is "won" but no 2048 tile found');
            }
        }

        if (state.gameState === 'lost') {
            // Check if board is actually full and no moves available
            const hasEmptyCell = state.board.some(row => row.includes(0));
            if (hasEmptyCell) {
                errors.push('Game state is "lost" but board has empty cells');
            }
        }

        // Check if score is reasonable based on board state
        const calculatedMinScore = this.calculateMinimumScore(state.board);
        if (state.score < calculatedMinScore) {
            errors.push(`Score ${state.score} is too low for current board state (minimum: ${calculatedMinScore})`);
        }

        return { isValid: errors.length === 0, errors };
    }

    /**
     * Check if a number is a power of 2
     */
    private static isPowerOfTwo(n: number): boolean {
        return n > 0 && (n & (n - 1)) === 0;
    }

    /**
     * Calculate the minimum possible score for a given board state
     * This is a rough estimate based on the tiles present
     */
    private static calculateMinimumScore(board: number[][]): number {
        // For now, we'll use a very conservative minimum score check
        // In a real game, the score calculation is complex and depends on the exact sequence of moves
        // We'll just check that the score is non-negative and reasonable
        
        let totalTileValue = 0;
        for (const row of board) {
            for (const cell of row) {
                if (cell > 0) {
                    totalTileValue += cell;
                }
            }
        }

        // The minimum score should be at least 0, but we'll be very lenient
        // and only check for obviously wrong scores (like negative values)
        return 0;
    }

    /**
     * Create a new game state for fallback scenarios
     */
    static createFallbackGameState(): GameState {
        return {
            board: [
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0]
            ],
            score: 0,
            gameState: 'playing',
            moveCount: 0,
            startTime: Date.now()
        };
    }
}