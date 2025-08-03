/**
 * Unit tests for game state serialization functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameStateSerialization, SerializationResult, DeserializationResult } from './gameStateSerialization';
import { GameState } from './gameEngine';

describe('GameStateSerialization', () => {
    let validGameState: GameState;

    beforeEach(() => {
        validGameState = {
            board: [
                [2, 4, 8, 16],
                [32, 64, 128, 256],
                [512, 1024, 2048, 0],
                [0, 0, 0, 0]
            ],
            score: 12345,
            gameState: 'won',
            moveCount: 42,
            startTime: Date.now() - 1000000 // 1000 seconds ago
        };
    });

    describe('serialize', () => {
        it('should successfully serialize a valid game state', () => {
            const result: SerializationResult = GameStateSerialization.serialize(validGameState);
            
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            
            // Verify the serialized data contains expected structure
            const parsed = JSON.parse(result.data!);
            expect(parsed.header).toBe('2048_GAME_STATE');
            expect(parsed.version).toBe(1);
            expect(parsed.state).toEqual(validGameState);
        });

        it('should fail to serialize invalid game state - null state', () => {
            const result: SerializationResult = GameStateSerialization.serialize(null as any);
            
            expect(result.success).toBe(false);
            expect(result.data).toBeUndefined();
            expect(result.error).toContain('Invalid game state');
        });

        it('should fail to serialize invalid game state - invalid board', () => {
            const invalidState = {
                ...validGameState,
                board: [[1, 2], [3, 4]] // Wrong dimensions
            };
            
            const result: SerializationResult = GameStateSerialization.serialize(invalidState);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Board must have exactly 4 rows');
        });

        it('should fail to serialize invalid game state - negative score', () => {
            const invalidState = {
                ...validGameState,
                score: -100
            };
            
            const result: SerializationResult = GameStateSerialization.serialize(invalidState);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Score must be a non-negative number');
        });

        it('should fail to serialize invalid game state - invalid game state value', () => {
            const invalidState = {
                ...validGameState,
                gameState: 'invalid' as any
            };
            
            const result: SerializationResult = GameStateSerialization.serialize(invalidState);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('GameState must be "playing", "won", or "lost"');
        });
    });

    describe('deserialize', () => {
        let validSerializedData: string;

        beforeEach(() => {
            const serializeResult = GameStateSerialization.serialize(validGameState);
            validSerializedData = serializeResult.data!;
        });

        it('should successfully deserialize valid serialized data', () => {
            const result: DeserializationResult = GameStateSerialization.deserialize(validSerializedData);
            
            expect(result.success).toBe(true);
            expect(result.state).toEqual(validGameState);
            expect(result.error).toBeUndefined();
            expect(result.fallbackToNewGame).toBeUndefined();
        });

        it('should fail to deserialize empty string', () => {
            const result: DeserializationResult = GameStateSerialization.deserialize('');
            
            expect(result.success).toBe(false);
            expect(result.state).toBeUndefined();
            expect(result.error).toContain('Invalid input');
            expect(result.fallbackToNewGame).toBe(true);
        });

        it('should fail to deserialize invalid JSON', () => {
            const result: DeserializationResult = GameStateSerialization.deserialize('invalid json {');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid JSON format');
            expect(result.fallbackToNewGame).toBe(true);
        });

        it('should fail to deserialize data without magic header', () => {
            const invalidData = JSON.stringify({
                version: 1,
                state: validGameState
            });
            
            const result: DeserializationResult = GameStateSerialization.deserialize(invalidData);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('missing or incorrect header');
            expect(result.fallbackToNewGame).toBe(true);
        });

        it('should fail to deserialize data with wrong version', () => {
            const invalidData = JSON.stringify({
                header: '2048_GAME_STATE',
                version: 999,
                state: validGameState
            });
            
            const result: DeserializationResult = GameStateSerialization.deserialize(invalidData);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Unsupported game state version');
            expect(result.fallbackToNewGame).toBe(true);
        });

        it('should fail to deserialize data without state', () => {
            const invalidData = JSON.stringify({
                header: '2048_GAME_STATE',
                version: 1
                // Missing state
            });
            
            const result: DeserializationResult = GameStateSerialization.deserialize(invalidData);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Missing game state data');
            expect(result.fallbackToNewGame).toBe(true);
        });
    });

    describe('validateGameState', () => {
        it('should validate a correct game state', () => {
            const result = GameStateSerialization.validateGameState(validGameState);
            
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject null or undefined state', () => {
            const result = GameStateSerialization.validateGameState(null);
            
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('State must be an object');
        });

        it('should reject state with invalid board structure', () => {
            const invalidState = {
                ...validGameState,
                board: [[1, 2, 3]] // Wrong dimensions
            };
            
            const result = GameStateSerialization.validateGameState(invalidState);
            
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('Board must have exactly 4 rows'))).toBe(true);
        });

        it('should reject state with non-numeric board values', () => {
            const invalidState = {
                ...validGameState,
                board: [
                    [2, 4, 'invalid', 16],
                    [32, 64, 128, 256],
                    [512, 1024, 2048, 0],
                    [0, 0, 0, 0]
                ]
            };
            
            const result = GameStateSerialization.validateGameState(invalidState);
            
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('must be a non-negative number'))).toBe(true);
        });

        it('should reject state with negative board values', () => {
            const invalidState = {
                ...validGameState,
                board: [
                    [2, 4, -8, 16],
                    [32, 64, 128, 256],
                    [512, 1024, 2048, 0],
                    [0, 0, 0, 0]
                ]
            };
            
            const result = GameStateSerialization.validateGameState(invalidState);
            
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('must be a non-negative number'))).toBe(true);
        });
    });

    describe('checkGameStateIntegrity', () => {
        it('should pass integrity check for valid game state', () => {
            const result = GameStateSerialization.checkGameStateIntegrity(validGameState);
            
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should fail integrity check for invalid tile values', () => {
            const invalidState = {
                ...validGameState,
                board: [
                    [2, 4, 7, 16], // 7 is not a power of 2
                    [32, 64, 128, 256],
                    [512, 1024, 2048, 0],
                    [0, 0, 0, 0]
                ]
            };
            
            const result = GameStateSerialization.checkGameStateIntegrity(invalidState);
            
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('Invalid tile value 7'))).toBe(true);
        });

        it('should fail integrity check for future start time', () => {
            const invalidState = {
                ...validGameState,
                startTime: Date.now() + 1000000 // Future time
            };
            
            const result = GameStateSerialization.checkGameStateIntegrity(invalidState);
            
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('Start time cannot be in the future'))).toBe(true);
        });

        it('should fail integrity check for too old game state', () => {
            const invalidState = {
                ...validGameState,
                startTime: Date.now() - (8 * 24 * 60 * 60 * 1000) // 8 days ago
            };
            
            const result = GameStateSerialization.checkGameStateIntegrity(invalidState);
            
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('Game state is too old'))).toBe(true);
        });

        it('should fail integrity check for inconsistent won state', () => {
            const invalidState = {
                ...validGameState,
                gameState: 'won' as const,
                board: [
                    [2, 4, 8, 16],
                    [32, 64, 128, 256],
                    [512, 1024, 0, 0], // No 2048 tile
                    [0, 0, 0, 0]
                ]
            };
            
            const result = GameStateSerialization.checkGameStateIntegrity(invalidState);
            
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('Game state is "won" but no 2048 tile found'))).toBe(true);
        });

        it('should fail integrity check for inconsistent lost state', () => {
            const invalidState = {
                ...validGameState,
                gameState: 'lost' as const,
                board: [
                    [2, 4, 8, 0], // Has empty cell
                    [32, 64, 128, 256],
                    [512, 1024, 2048, 4],
                    [8, 16, 32, 64]
                ]
            };
            
            const result = GameStateSerialization.checkGameStateIntegrity(invalidState);
            
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('Game state is "lost" but board has empty cells'))).toBe(true);
        });
    });

    describe('createFallbackGameState', () => {
        it('should create a valid fallback game state', () => {
            const fallbackState = GameStateSerialization.createFallbackGameState();
            
            expect(fallbackState.board).toEqual([
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0]
            ]);
            expect(fallbackState.score).toBe(0);
            expect(fallbackState.gameState).toBe('playing');
            expect(fallbackState.moveCount).toBe(0);
            expect(fallbackState.startTime).toBeGreaterThan(0);
            
            // Validate that the fallback state passes validation
            const validationResult = GameStateSerialization.validateGameState(fallbackState);
            expect(validationResult.isValid).toBe(true);
        });
    });

    describe('round-trip serialization', () => {
        it('should maintain data integrity through serialize-deserialize cycle', () => {
            const serializeResult = GameStateSerialization.serialize(validGameState);
            expect(serializeResult.success).toBe(true);
            
            const deserializeResult = GameStateSerialization.deserialize(serializeResult.data!);
            expect(deserializeResult.success).toBe(true);
            
            expect(deserializeResult.state).toEqual(validGameState);
        });

        it('should handle multiple serialize-deserialize cycles', () => {
            let currentState = validGameState;
            
            for (let i = 0; i < 5; i++) {
                const serializeResult = GameStateSerialization.serialize(currentState);
                expect(serializeResult.success).toBe(true);
                
                const deserializeResult = GameStateSerialization.deserialize(serializeResult.data!);
                expect(deserializeResult.success).toBe(true);
                
                currentState = deserializeResult.state!;
            }
            
            expect(currentState).toEqual(validGameState);
        });
    });
});