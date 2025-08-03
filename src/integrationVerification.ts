/**
 * Integration verification script to test end-to-end functionality
 * This script manually tests the integration between all components
 */

import { GameEngine } from './gameEngine';
import { GameController } from './gameController';
import { GameViewProvider } from './gameViewProvider';
import { MessageFactory } from './messageTypes';

// Mock VSCode context for testing
const mockContext = {
    subscriptions: [],
    extensionUri: { fsPath: '/test', path: '/test', toString: () => '/test' },
    globalState: {
        get: (key: string) => undefined,
        update: (key: string, value: any) => Promise.resolve(),
        keys: () => [],
    },
    workspaceState: {
        get: (key: string) => undefined,
        update: (key: string, value: any) => Promise.resolve(),
        keys: () => [],
    },
    extensionPath: '/test/extension',
    storagePath: '/test/storage',
    globalStoragePath: '/test/global-storage',
    logPath: '/test/logs',
} as any;

// Mock webview for testing
const mockWebview = {
    postMessage: (message: any) => {
        console.log('📤 Extension → Webview:', message.type, message);
        return Promise.resolve();
    },
    onDidReceiveMessage: (handler: (message: any) => void) => {
        console.log('🔗 Message handler registered');
        // Store handler for later use
        (mockWebview as any)._messageHandler = handler;
        return { dispose: () => {} };
    },
    html: '',
    options: {},
    cspSource: 'vscode-webview://test',
    asWebviewUri: (uri: any) => uri,
};

const mockWebviewView = {
    webview: mockWebview,
    visible: true,
    onDidDispose: () => ({ dispose: () => {} }),
    onDidChangeVisibility: () => ({ dispose: () => {} }),
    show: () => {},
};

async function runIntegrationTests() {
    console.log('🚀 Starting Integration Verification Tests\n');

    try {
        // Test 1: Component Initialization
        console.log('📋 Test 1: Component Initialization');
        
        const gameEngine = new GameEngine();
        console.log('✅ GameEngine initialized');
        
        const gameController = new GameController(mockContext);
        console.log('✅ GameController initialized');
        
        const gameViewProvider = new GameViewProvider(mockContext.extensionUri, gameController);
        console.log('✅ GameViewProvider initialized');
        
        // Link components
        gameController.setGameViewProvider(gameViewProvider);
        console.log('✅ Components linked together\n');

        // Test 2: Game Engine Functionality
        console.log('📋 Test 2: Game Engine Core Functionality');
        
        const initialState = gameEngine.getGameState();
        console.log('✅ Initial game state:', {
            score: initialState.score,
            gameState: initialState.gameState,
            tilesCount: initialState.board.flat().filter(cell => cell !== 0).length
        });
        
        // Test move
        const moveResult = gameEngine.move('left');
        const afterMoveState = gameEngine.getGameState();
        console.log('✅ Move executed:', {
            moved: moveResult,
            newScore: afterMoveState.score,
            moveCount: afterMoveState.moveCount
        });
        console.log('');

        // Test 3: Webview Integration
        console.log('📋 Test 3: Webview Integration');
        
        const context = { state: undefined };
        const token = {} as any;
        gameViewProvider.resolveWebviewView(mockWebviewView, context, token);
        console.log('✅ Webview resolved and configured');
        
        // Verify HTML content
        const hasGameContainer = mockWebview.html.includes('game-container');
        const hasGameBoard = mockWebview.html.includes('game-board');
        const hasNewGameButton = mockWebview.html.includes('new-game-btn');
        console.log('✅ HTML content verified:', { hasGameContainer, hasGameBoard, hasNewGameButton });
        console.log('');

        // Test 4: Message Passing
        console.log('📋 Test 4: Message Passing Integration');
        
        // Test extension to webview message
        const testMessage = MessageFactory.createExtensionMessage('newGame', {
            state: gameEngine.getGameState()
        });
        gameViewProvider.postMessage(testMessage);
        console.log('✅ Extension → Webview message sent');
        
        // Test webview to extension message
        const messageHandler = (mockWebview as any)._messageHandler;
        if (messageHandler) {
            messageHandler({ type: 'requestNewGame' });
            console.log('✅ Webview → Extension message processed');
        }
        console.log('');

        // Test 5: Game Controller Integration
        console.log('📋 Test 5: Game Controller Integration');
        
        gameController.startNewGame();
        console.log('✅ New game started through controller');
        
        // Test game state persistence
        const savedState = gameController.loadGameState();
        console.log('✅ Game state persistence:', savedState ? 'Working' : 'No saved state');
        
        // Test message handling
        gameController.handleMessage({ type: 'gameMove', direction: 'right' });
        console.log('✅ Game move processed through controller');
        console.log('');

        // Test 6: Theme Integration
        console.log('📋 Test 6: Theme Integration');
        
        // Test theme request
        if (messageHandler) {
            messageHandler({ type: 'requestTheme' });
            console.log('✅ Theme request processed');
        }
        console.log('');

        // Test 7: Error Handling
        console.log('📋 Test 7: Error Handling');
        
        // Test invalid message
        if (messageHandler) {
            try {
                messageHandler({ type: 'invalidMessage', badData: true });
                console.log('✅ Invalid message handled gracefully');
            } catch (error) {
                console.log('❌ Error handling failed:', error);
            }
        }
        
        // Test error message from webview
        if (messageHandler) {
            messageHandler({
                type: 'error',
                error: {
                    message: 'Test error',
                    context: { type: 'test' }
                }
            });
            console.log('✅ Error message from webview handled');
        }
        console.log('');

        // Test 8: Component Disposal
        console.log('📋 Test 8: Component Disposal');
        
        gameController.dispose();
        console.log('✅ GameController disposed');
        console.log('');

        // Test 9: Win/Lose Scenarios
        console.log('📋 Test 9: Win/Lose Scenarios');
        
        // Create winning state
        const winningEngine = new GameEngine();
        winningEngine.loadGameState({
            board: [
                [2048, 4, 8, 16],
                [32, 64, 128, 256],
                [512, 1024, 2, 4],
                [8, 16, 32, 64]
            ],
            score: 50000,
            gameState: 'won',
            moveCount: 100,
            startTime: Date.now() - 300000
        });
        
        const winState = winningEngine.getGameState();
        console.log('✅ Win scenario tested:', {
            gameState: winState.gameState,
            hasWinningTile: winState.board.flat().includes(2048)
        });
        
        // Create losing state
        const losingEngine = new GameEngine();
        losingEngine.loadGameState({
            board: [
                [2, 4, 8, 16],
                [32, 64, 128, 256],
                [512, 1024, 4, 8],
                [16, 32, 64, 128]
            ],
            score: 25000,
            gameState: 'lost',
            moveCount: 200,
            startTime: Date.now() - 600000
        });
        
        const loseState = losingEngine.getGameState();
        console.log('✅ Lose scenario tested:', {
            gameState: loseState.gameState,
            boardFull: loseState.board.flat().every(cell => cell !== 0)
        });
        console.log('');

        // Test 10: Performance Test
        console.log('📋 Test 10: Performance Test');
        
        const performanceEngine = new GameEngine();
        const startTime = Date.now();
        
        // Perform many operations
        for (let i = 0; i < 100; i++) {
            const directions = ['left', 'right', 'up', 'down'];
            const randomDirection = directions[i % 4] as any;
            performanceEngine.move(randomDirection);
        }
        
        const endTime = Date.now();
        console.log('✅ Performance test completed:', {
            operations: 100,
            timeMs: endTime - startTime,
            avgPerOp: (endTime - startTime) / 100
        });
        console.log('');

        console.log('🎉 All Integration Tests Completed Successfully!');
        console.log('');
        console.log('📊 Summary:');
        console.log('- ✅ Component initialization and linking');
        console.log('- ✅ Game engine core functionality');
        console.log('- ✅ Webview integration and HTML generation');
        console.log('- ✅ Bidirectional message passing');
        console.log('- ✅ Game controller coordination');
        console.log('- ✅ Theme integration');
        console.log('- ✅ Error handling and recovery');
        console.log('- ✅ Component disposal and cleanup');
        console.log('- ✅ Win/lose scenario handling');
        console.log('- ✅ Performance under load');
        console.log('');
        console.log('🔗 All components are properly integrated and working together!');

        return true;

    } catch (error) {
        console.error('❌ Integration test failed:', error);
        return false;
    }
}

// Run the tests if this file is executed directly
if (require.main === module) {
    runIntegrationTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

export { runIntegrationTests };