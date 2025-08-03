import * as vscode from 'vscode';
import { GameViewProvider } from './gameViewProvider';
import { GameController } from './gameController';

/**
 * Extension Error Handler for comprehensive error management
 * Provides graceful degradation, logging, and fallback behaviors
 */
class ExtensionErrorHandler {
    private static instance: ExtensionErrorHandler;
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private errorCount: number = 0;
    private maxErrors: number = 10;
    private criticalErrors: Set<string> = new Set([
        'ACTIVATION_FAILURE',
        'CONTROLLER_CREATION_FAILURE',
        'VIEW_PROVIDER_REGISTRATION_FAILURE'
    ]);

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('2048 Game');
        this.setupGlobalErrorHandlers();
    }

    public static getInstance(context: vscode.ExtensionContext): ExtensionErrorHandler {
        if (!ExtensionErrorHandler.instance) {
            ExtensionErrorHandler.instance = new ExtensionErrorHandler(context);
        }
        return ExtensionErrorHandler.instance;
    }

    /**
     * Set up global error handlers for unhandled exceptions
     */
    private setupGlobalErrorHandlers(): void {
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            this.handleError(
                new Error(`Unhandled Promise Rejection: ${reason}`),
                'UNHANDLED_PROMISE_REJECTION',
                { promise, reason }
            );
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            this.handleError(error, 'UNCAUGHT_EXCEPTION');
        });
    }

    /**
     * Handle errors with comprehensive logging and recovery
     * @param error - The error that occurred
     * @param errorCode - Error code for categorization
     * @param context - Additional context about the error
     */
    public handleError(error: Error, errorCode: string = 'UNKNOWN_ERROR', context: any = {}): void {
        try {
            this.errorCount++;
            const timestamp = new Date().toISOString();
            
            // Log to output channel
            this.outputChannel.appendLine(`[${timestamp}] ERROR: ${errorCode}`);
            this.outputChannel.appendLine(`Message: ${error.message}`);
            this.outputChannel.appendLine(`Stack: ${error.stack}`);
            this.outputChannel.appendLine(`Context: ${JSON.stringify(context, null, 2)}`);
            this.outputChannel.appendLine('---');

            // Log to console for development
            console.error(`[2048 Game] ${errorCode}:`, {
                error: error.message,
                stack: error.stack,
                context,
                count: this.errorCount,
                timestamp
            });

            // Determine if this is a critical error
            const isCritical = this.criticalErrors.has(errorCode) || this.errorCount >= this.maxErrors;

            if (isCritical) {
                this.handleCriticalError(error, errorCode, context);
            } else {
                this.handleRecoverableError(error, errorCode, context);
            }

        } catch (handlerError) {
            // Last resort error handling
            console.error('Error in error handler:', handlerError);
            vscode.window.showErrorMessage('2048 Game: Multiple errors occurred. Extension may be unstable.');
        }
    }

    /**
     * Handle recoverable errors with automatic recovery attempts
     */
    private handleRecoverableError(error: Error, errorCode: string, context: any): void {
        const userMessage = this.getUserFriendlyMessage(errorCode, error.message);
        
        // Show non-intrusive warning
        vscode.window.showWarningMessage(userMessage);
        
        // Attempt recovery based on error type
        this.attemptRecovery(errorCode, context);
    }

    /**
     * Handle critical errors that require user intervention
     */
    private handleCriticalError(error: Error, errorCode: string, context: any): void {
        const userMessage = this.getUserFriendlyMessage(errorCode, error.message);
        
        // Show error message with action buttons
        vscode.window.showErrorMessage(
            userMessage,
            'Show Logs',
            'Reload Extension',
            'Report Issue'
        ).then(selection => {
            switch (selection) {
                case 'Show Logs':
                    this.outputChannel.show();
                    break;
                case 'Reload Extension':
                    vscode.commands.executeCommand('workbench.action.reloadWindow');
                    break;
                case 'Report Issue':
                    this.openIssueReporter(error, errorCode, context);
                    break;
            }
        });
    }

    /**
     * Attempt automatic recovery based on error type
     */
    private attemptRecovery(errorCode: string, context: any): void {
        try {
            switch (errorCode) {
                case 'GAME_CONTROLLER_ERROR':
                    this.recoverGameController(context);
                    break;
                case 'VIEW_PROVIDER_ERROR':
                    this.recoverViewProvider(context);
                    break;
                case 'COMMAND_REGISTRATION_ERROR':
                    this.recoverCommands(context);
                    break;
                case 'STORAGE_ERROR':
                    this.recoverStorage(context);
                    break;
                default:
                    this.performGeneralRecovery();
            }
        } catch (recoveryError) {
            this.handleError(
                recoveryError as Error,
                'RECOVERY_FAILURE',
                { originalError: errorCode, originalContext: context }
            );
        }
    }

    /**
     * Recover game controller functionality
     */
    private recoverGameController(context: any): void {
        this.outputChannel.appendLine('Attempting game controller recovery...');
        
        try {
            // Try to reinitialize game controller if possible
            if (context.gameController && typeof context.gameController.initialize === 'function') {
                context.gameController.initialize();
                this.outputChannel.appendLine('Game controller recovered successfully');
                vscode.window.showInformationMessage('2048 Game: Controller recovered');
            }
        } catch (error) {
            throw new Error('Game controller recovery failed');
        }
    }

    /**
     * Recover view provider functionality
     */
    private recoverViewProvider(context: any): void {
        this.outputChannel.appendLine('Attempting view provider recovery...');
        
        // For view provider issues, we typically need to reload the extension
        vscode.window.showWarningMessage(
            '2048 Game: View provider issue detected. Reload recommended.',
            'Reload Extension'
        ).then(selection => {
            if (selection === 'Reload Extension') {
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
        });
    }

    /**
     * Recover command registration
     */
    private recoverCommands(context: any): void {
        this.outputChannel.appendLine('Attempting command recovery...');
        
        try {
            // Try to re-register commands if possible
            if (context.gameController) {
                const newGameCommand = vscode.commands.registerCommand('2048Game.newGame', () => {
                    try {
                        context.gameController.startNewGame();
                        vscode.window.showInformationMessage('New 2048 game started!');
                    } catch (error) {
                        this.handleError(error as Error, 'NEW_GAME_COMMAND_ERROR');
                    }
                });
                
                this.context.subscriptions.push(newGameCommand);
                this.outputChannel.appendLine('Commands recovered successfully');
            }
        } catch (error) {
            throw new Error('Command recovery failed');
        }
    }

    /**
     * Recover storage functionality
     */
    private recoverStorage(context: any): void {
        this.outputChannel.appendLine('Attempting storage recovery...');
        
        try {
            // Clear potentially corrupted storage
            const keys = this.context.globalState.keys();
            const gameKeys = keys.filter(key => key.startsWith('2048Game.'));
            
            for (const key of gameKeys) {
                this.context.globalState.update(key, undefined);
            }
            
            this.outputChannel.appendLine('Storage cleared and recovered');
            vscode.window.showInformationMessage('2048 Game: Storage recovered, saved games cleared');
        } catch (error) {
            throw new Error('Storage recovery failed');
        }
    }

    /**
     * Perform general recovery operations
     */
    private performGeneralRecovery(): void {
        this.outputChannel.appendLine('Performing general recovery...');
        
        // Reset error count after some time
        setTimeout(() => {
            this.errorCount = Math.max(0, this.errorCount - 1);
        }, 60000); // Reduce error count after 1 minute
        
        this.outputChannel.appendLine('General recovery completed');
    }

    /**
     * Get user-friendly error message
     */
    private getUserFriendlyMessage(errorCode: string, originalMessage: string): string {
        const messages: { [key: string]: string } = {
            'ACTIVATION_FAILURE': '2048 Game failed to activate. Please reload VSCode.',
            'CONTROLLER_CREATION_FAILURE': '2048 Game controller failed to initialize. Some features may not work.',
            'VIEW_PROVIDER_REGISTRATION_FAILURE': '2048 Game view failed to register. Please reload the extension.',
            'GAME_CONTROLLER_ERROR': '2048 Game controller encountered an error. Attempting recovery.',
            'VIEW_PROVIDER_ERROR': '2048 Game view encountered an error. Some features may not work.',
            'COMMAND_REGISTRATION_ERROR': '2048 Game commands failed to register. Attempting recovery.',
            'STORAGE_ERROR': '2048 Game storage error. Saved games may be affected.',
            'NEW_GAME_COMMAND_ERROR': 'Failed to start new game. Please try again.',
            'UNHANDLED_PROMISE_REJECTION': '2048 Game: An operation failed unexpectedly.',
            'UNCAUGHT_EXCEPTION': '2048 Game: A critical error occurred.',
            'RECOVERY_FAILURE': '2048 Game: Recovery failed. Please reload the extension.'
        };

        return messages[errorCode] || `2048 Game Error: ${originalMessage}`;
    }

    /**
     * Open issue reporter with error details
     */
    private openIssueReporter(error: Error, errorCode: string, context: any): void {
        const issueBody = encodeURIComponent(`
**Error Code:** ${errorCode}
**Error Message:** ${error.message}
**Stack Trace:**
\`\`\`
${error.stack}
\`\`\`
**Context:** ${JSON.stringify(context, null, 2)}
**VSCode Version:** ${vscode.version}
**Extension Version:** [Please fill in]
**OS:** ${process.platform}

**Steps to Reproduce:**
1. [Please describe what you were doing when the error occurred]

**Additional Information:**
[Any additional information that might be helpful]
        `);

        const issueUrl = `https://github.com/your-repo/vscode-2048-extension/issues/new?body=${issueBody}`;
        vscode.env.openExternal(vscode.Uri.parse(issueUrl));
    }

    /**
     * Wrap a function with error handling
     */
    public wrap<T extends (...args: any[]) => any>(
        fn: T,
        errorCode: string = 'WRAPPED_FUNCTION_ERROR',
        context: any = {}
    ): T {
        return ((...args: any[]) => {
            try {
                return fn.apply(this, args);
            } catch (error) {
                this.handleError(error as Error, errorCode, { ...context, args });
                return null;
            }
        }) as T;
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.outputChannel.dispose();
    }
}

export function activate(context: vscode.ExtensionContext) {
    const errorHandler = ExtensionErrorHandler.getInstance(context);
    
    try {
        console.log('2048 Game extension is now active!');
        
        // Wrap the entire activation in error handling
        const activationResult = errorHandler.wrap(() => {
            let gameController: GameController;
            let provider: GameViewProvider;
            
            try {
                // Create the game controller with error handling
                gameController = new GameController(context);
                console.log('Game controller created successfully');
            } catch (error) {
                errorHandler.handleError(error as Error, 'CONTROLLER_CREATION_FAILURE');
                throw error;
            }
            
            try {
                // Initialize the game controller (loads saved game if available)
                gameController.initialize();
                console.log('Game controller initialized successfully');
            } catch (error) {
                errorHandler.handleError(error as Error, 'CONTROLLER_INITIALIZATION_ERROR');
                // Continue without saved game
            }
            
            try {
                // Create and register the webview view provider
                provider = new GameViewProvider(context.extensionUri, gameController);
                console.log('Game view provider created successfully');
            } catch (error) {
                errorHandler.handleError(error as Error, 'VIEW_PROVIDER_CREATION_FAILURE');
                throw error;
            }
            
            try {
                // Set up the bidirectional relationship
                gameController.setGameViewProvider(provider);
                console.log('Controller-provider relationship established');
            } catch (error) {
                errorHandler.handleError(error as Error, 'CONTROLLER_PROVIDER_LINK_ERROR');
                // Continue without bidirectional link
            }
            
            let viewProviderDisposable: vscode.Disposable;
            try {
                // Register the webview view provider
                viewProviderDisposable = vscode.window.registerWebviewViewProvider(
                    GameViewProvider.viewType,
                    provider,
                    {
                        webviewOptions: {
                            retainContextWhenHidden: true
                        }
                    }
                );
                console.log('Webview view provider registered successfully');
            } catch (error) {
                errorHandler.handleError(error as Error, 'VIEW_PROVIDER_REGISTRATION_FAILURE');
                throw error;
            }
            
            let newGameCommand: vscode.Disposable | undefined;
            let shareScoreCommand: vscode.Disposable | undefined;
            
            try {
                // Register the new game command with error handling
                newGameCommand = vscode.commands.registerCommand('2048Game.newGame', errorHandler.wrap(() => {
                    gameController.startNewGame();
                    vscode.window.showInformationMessage('New 2048 game started!');
                }, 'NEW_GAME_COMMAND_ERROR', { command: '2048Game.newGame' }));
                console.log('New game command registered successfully');
            } catch (error) {
                errorHandler.handleError(error as Error, 'COMMAND_REGISTRATION_ERROR');
                // Continue without command
            }

            try {
                // Register the share score command with error handling
                shareScoreCommand = vscode.commands.registerCommand('2048Game.shareScore', errorHandler.wrap(() => {
                    gameController.shareCurrentScore();
                }, 'SHARE_SCORE_COMMAND_ERROR', { command: '2048Game.shareScore' }));
                console.log('Share score command registered successfully');
            } catch (error) {
                errorHandler.handleError(error as Error, 'COMMAND_REGISTRATION_ERROR');
                // Continue without command
            }
            
            // Create a disposable for the game controller
            const gameControllerDisposable = {
                dispose: errorHandler.wrap(() => {
                    gameController.dispose();
                }, 'CONTROLLER_DISPOSAL_ERROR')
            };
            
            // Create a disposable for the error handler
            const errorHandlerDisposable = {
                dispose: () => errorHandler.dispose()
            };
            
            // Add disposables to context subscriptions for proper cleanup
            const disposables = [errorHandlerDisposable, gameControllerDisposable];
            
            if (viewProviderDisposable) {
                disposables.push(viewProviderDisposable);
            }
            if (newGameCommand) {
                disposables.push(newGameCommand);
            }
            if (shareScoreCommand) {
                disposables.push(shareScoreCommand);
            }
            
            context.subscriptions.push(...disposables);
            
            console.log('2048 Game extension activation completed successfully');
            
            // Show success message only in development
            if (process.env.NODE_ENV === 'development') {
                vscode.window.showInformationMessage('2048 Game extension activated successfully!');
            }
            
            return { gameController, provider, errorHandler };
            
        }, 'ACTIVATION_FAILURE')();
        
        return activationResult;
        
    } catch (error) {
        // Last resort error handling
        console.error('Critical activation failure:', error);
        errorHandler.handleError(error as Error, 'CRITICAL_ACTIVATION_FAILURE');
        
        // Show critical error message
        vscode.window.showErrorMessage(
            '2048 Game extension failed to activate. Please reload VSCode.',
            'Reload VSCode',
            'Show Logs'
        ).then(selection => {
            switch (selection) {
                case 'Reload VSCode':
                    vscode.commands.executeCommand('workbench.action.reloadWindow');
                    break;
                case 'Show Logs':
                    // Access output channel through a public method if available
                    console.log('Show logs requested');
                    break;
            }
        });
        
        throw error;
    }
}

export function deactivate() {
    try {
        console.log('2048 Game extension is now deactivated!');
        // Cleanup is handled automatically by VSCode through context subscriptions
        // The gameController.dispose() and errorHandler.dispose() will be called automatically
    } catch (error) {
        console.error('Error during deactivation:', error);
        // Don't throw during deactivation to avoid issues
    }
}