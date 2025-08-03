export interface GameState {
    board: number[][];
    score: number;
    gameState: 'playing' | 'won' | 'lost';
    moveCount: number;
    startTime: number;
}

export class GameEngine {
    private _board: number[][];
    private _score: number;
    private _gameState: 'playing' | 'won' | 'lost';
    private _moveCount: number;
    private _startTime: number;

    constructor() {
        this._board = [];
        this._score = 0;
        this._gameState = 'playing';
        this._moveCount = 0;
        this._startTime = Date.now();
        this.initializeGame();
    }

    get board(): number[][] {
        return this._board.map(row => [...row]); // Return a copy to prevent external modification
    }

    get score(): number {
        return this._score;
    }

    get gameState(): 'playing' | 'won' | 'lost' {
        return this._gameState;
    }

    get moveCount(): number {
        return this._moveCount;
    }

    get startTime(): number {
        return this._startTime;
    }

    /**
     * Initialize a new 4x4 game board with two random tiles
     */
    initializeGame(): void {
        // Create empty 4x4 board
        this._board = Array(4).fill(null).map(() => Array(4).fill(0));
        this._score = 0;
        this._gameState = 'playing';
        this._moveCount = 0;
        this._startTime = Date.now();

        // Add two initial random tiles
        this.addRandomTile();
        this.addRandomTile();
    }

    /**
     * Add a random tile (2 or 4) to an empty cell on the board
     * @returns true if a tile was added, false if no empty cells available
     */
    addRandomTile(): boolean {
        const emptyCells = this.getEmptyCells();
        
        if (emptyCells.length === 0) {
            return false;
        }

        // Select random empty cell
        const randomIndex = Math.floor(Math.random() * emptyCells.length);
        const [row, col] = emptyCells[randomIndex];

        // 90% chance for 2, 10% chance for 4
        const value = Math.random() < 0.9 ? 2 : 4;
        this._board[row][col] = value;

        return true;
    }

    /**
     * Get all empty cells on the board
     * @returns Array of [row, col] coordinates for empty cells
     */
    private getEmptyCells(): [number, number][] {
        const emptyCells: [number, number][] = [];
        
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                if (this._board[row][col] === 0) {
                    emptyCells.push([row, col]);
                }
            }
        }
        
        return emptyCells;
    }

    /**
     * Get the current game state as a serializable object
     */
    getGameState(): GameState {
        return {
            board: this.board,
            score: this._score,
            gameState: this._gameState,
            moveCount: this._moveCount,
            startTime: this._startTime
        };
    }

    /**
     * Load a game state from a serialized object
     */
    loadGameState(state: GameState): void {
        this._board = state.board.map(row => [...row]);
        this._score = state.score;
        this._gameState = state.gameState;
        this._moveCount = state.moveCount;
        this._startTime = state.startTime;
    }

    /**
     * Move tiles in the specified direction
     * @param direction The direction to move tiles
     * @returns true if any tiles moved, false otherwise
     */
    move(direction: 'up' | 'down' | 'left' | 'right'): boolean {
        const previousBoard = this.board;
        let moved = false;

        switch (direction) {
            case 'left':
                moved = this.moveLeft();
                break;
            case 'right':
                moved = this.moveRight();
                break;
            case 'up':
                moved = this.moveUp();
                break;
            case 'down':
                moved = this.moveDown();
                break;
        }

        if (moved) {
            this._moveCount++;
            this.addRandomTile();
            this.updateGameState();
        }

        return moved;
    }

    /**
     * Move and merge tiles to the left
     */
    private moveLeft(): boolean {
        let moved = false;
        
        for (let row = 0; row < 4; row++) {
            const originalRow = [...this._board[row]];
            const newRow = this.slideAndMergeRow(this._board[row]);
            this._board[row] = newRow;
            
            // Check if this row changed
            if (!this.arraysEqual(originalRow, newRow)) {
                moved = true;
            }
        }
        
        return moved;
    }

    /**
     * Move and merge tiles to the right
     */
    private moveRight(): boolean {
        let moved = false;
        
        for (let row = 0; row < 4; row++) {
            const originalRow = [...this._board[row]];
            // Reverse, slide left, then reverse back
            const reversedRow = [...this._board[row]].reverse();
            const newReversedRow = this.slideAndMergeRow(reversedRow);
            const newRow = newReversedRow.reverse();
            this._board[row] = newRow;
            
            // Check if this row changed
            if (!this.arraysEqual(originalRow, newRow)) {
                moved = true;
            }
        }
        
        return moved;
    }

    /**
     * Move and merge tiles up
     */
    private moveUp(): boolean {
        let moved = false;
        
        for (let col = 0; col < 4; col++) {
            // Extract column
            const originalColumn = [];
            for (let row = 0; row < 4; row++) {
                originalColumn.push(this._board[row][col]);
            }
            
            const newColumn = this.slideAndMergeRow(originalColumn);
            
            // Put column back
            for (let row = 0; row < 4; row++) {
                this._board[row][col] = newColumn[row];
            }
            
            // Check if this column changed
            if (!this.arraysEqual(originalColumn, newColumn)) {
                moved = true;
            }
        }
        
        return moved;
    }

    /**
     * Move and merge tiles down
     */
    private moveDown(): boolean {
        let moved = false;
        
        for (let col = 0; col < 4; col++) {
            // Extract column
            const originalColumn = [];
            for (let row = 0; row < 4; row++) {
                originalColumn.push(this._board[row][col]);
            }
            
            // Reverse, slide, then reverse back (like moveRight)
            const reversedColumn = [...originalColumn].reverse();
            const newReversedColumn = this.slideAndMergeRow(reversedColumn);
            const newColumn = newReversedColumn.reverse();
            
            // Put column back
            for (let row = 0; row < 4; row++) {
                this._board[row][col] = newColumn[row];
            }
            
            // Check if this column changed
            if (!this.arraysEqual(originalColumn, newColumn)) {
                moved = true;
            }
        }
        
        return moved;
    }

    /**
     * Slide and merge a single row/column to the left
     * @param line Array representing a row or column
     * @returns New array with tiles slid and merged
     */
    private slideAndMergeRow(line: number[]): number[] {
        // Remove zeros (slide tiles)
        const nonZeros = line.filter(val => val !== 0);
        
        // Merge adjacent equal tiles
        const merged: number[] = [];
        let i = 0;
        
        while (i < nonZeros.length) {
            if (i < nonZeros.length - 1 && nonZeros[i] === nonZeros[i + 1]) {
                // Merge tiles
                const mergedValue = nonZeros[i] * 2;
                merged.push(mergedValue);
                this._score += mergedValue;
                i += 2; // Skip both tiles
            } else {
                // No merge, just move tile
                merged.push(nonZeros[i]);
                i++;
            }
        }
        
        // Fill remaining positions with zeros
        while (merged.length < 4) {
            merged.push(0);
        }
        
        return merged;
    }

    /**
     * Check if two arrays are equal
     */
    private arraysEqual(a: number[], b: number[]): boolean {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    /**
     * Check if there are any available moves on the board
     * @returns true if moves are available, false if game is over
     */
    hasAvailableMoves(): boolean {
        // Check for empty cells
        if (this.getEmptyCells().length > 0) {
            return true;
        }

        // Check for possible merges horizontally
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 3; col++) {
                if (this._board[row][col] === this._board[row][col + 1]) {
                    return true;
                }
            }
        }

        // Check for possible merges vertically
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 4; col++) {
                if (this._board[row][col] === this._board[row + 1][col]) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if the player has won (reached 2048 tile)
     * @returns true if 2048 tile exists on the board
     */
    hasWon(): boolean {
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                if (this._board[row][col] === 2048) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Check if the game is over (no available moves)
     * @returns true if no moves are available
     */
    isGameOver(): boolean {
        return !this.hasAvailableMoves();
    }

    /**
     * Update the game state based on current board conditions
     * Should be called after each move to check win/lose conditions
     */
    updateGameState(): void {
        if (this._gameState === 'playing') {
            if (this.hasWon()) {
                this._gameState = 'won';
            } else if (this.isGameOver()) {
                this._gameState = 'lost';
            }
        }
    }

    /**
     * Get the highest tile value on the board
     * @returns The highest tile value
     */
    getHighestTile(): number {
        let highest = 0;
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                if (this._board[row][col] > highest) {
                    highest = this._board[row][col];
                }
            }
        }
        return highest;
    }

    /**
     * Check if a specific tile value exists on the board
     * @param value The tile value to search for
     * @returns true if the tile value exists
     */
    hasTile(value: number): boolean {
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                if (this._board[row][col] === value) {
                    return true;
                }
            }
        }
        return false;
    }
}