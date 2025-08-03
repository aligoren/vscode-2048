/**
 * Webview messaging utilities for the 2048 game extension
 * Handles message passing between webview and extension with error handling and retry logic
 */

import { WebviewToExtensionMessage, ExtensionToWebviewMessage, MessageValidator, MessageFactory } from './messageTypes';

// Declare window for webview environment
declare const window: any;

/**
 * WebviewMessageHandler class for managing webview to extension communication
 * Provides error handling, retry logic, and message validation
 */
export class WebviewMessageHandler {
    private vscode: any;
    private messageQueue: WebviewToExtensionMessage[] = [];
    private isOnline: boolean = true;
    private retryAttempts: Map<string, number> = new Map();
    private maxRetries: number = 3;
    private retryDelay: number = 1000; // 1 second
    private messageTimeout: number = 5000; // 5 seconds
    private pendingMessages: Map<string, { message: WebviewToExtensionMessage; timestamp: number }> = new Map();

    constructor(vscode: any) {
        this.vscode = vscode;
        this.setupErrorHandling();
        this.startMessageQueueProcessor();
    }

    /**
     * Send a message to the extension with error handling and retry logic
     * @param message - Message to send
     * @returns Promise that resolves when message is sent successfully
     */
    public async sendMessage(message: WebviewToExtensionMessage): Promise<void> {
        // Validate message before sending
        if (!MessageValidator.isValidWebviewMessage(message)) {
            const error = new Error(`Invalid message format: ${JSON.stringify(message)}`);
            console.error('Error sending message:', error);
            throw error;
        }

        try {
            // Add message ID and timestamp if not present
            if (!message.id) {
                message.id = Math.random().toString(36).substr(2, 9);
            }
            if (!message.timestamp) {
                message.timestamp = Date.now();
            }

            // Try to send immediately if online
            if (this.isOnline) {
                await this.attemptSend(message);
            } else {
                // Queue message for later if offline
                this.queueMessage(message);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.handleSendError(message, error);
            throw error;
        }
    }

    /**
     * Send a game move message
     * @param direction - Movement direction
     */
    public async sendGameMove(direction: 'up' | 'down' | 'left' | 'right'): Promise<void> {
        const message = MessageFactory.createWebviewMessage('gameMove', { direction });
        await this.sendMessage(message);
    }

    /**
     * Send a new game request
     */
    public async sendNewGameRequest(): Promise<void> {
        const message = MessageFactory.createWebviewMessage('requestNewGame');
        await this.sendMessage(message);
    }

    /**
     * Send a game state update
     * @param state - Current game state
     */
    public async sendGameStateUpdate(state: any): Promise<void> {
        const message = MessageFactory.createWebviewMessage('gameStateUpdate', { state });
        await this.sendMessage(message);
    }

    /**
     * Send a theme request
     */
    public async sendThemeRequest(): Promise<void> {
        const message = MessageFactory.createWebviewMessage('requestTheme');
        await this.sendMessage(message);
    }

    /**
     * Send a saved game request
     */
    public async sendSavedGameRequest(): Promise<void> {
        const message = MessageFactory.createWebviewMessage('requestSavedGame');
        await this.sendMessage(message);
    }

    /**
     * Send an error message to the extension
     * @param error - Error details
     */
    public async sendError(error: { message: string; stack?: string; context?: any }): Promise<void> {
        const message = MessageFactory.createWebviewMessage('error', { error });
        await this.sendMessage(message);
    }

    /**
     * Attempt to send a message with timeout
     * @param message - Message to send
     */
    private async attemptSend(message: WebviewToExtensionMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // Set up timeout
                const timeoutId = setTimeout(() => {
                    this.pendingMessages.delete(message.id!);
                    reject(new Error(`Message timeout: ${message.type}`));
                }, this.messageTimeout);

                // Store pending message
                this.pendingMessages.set(message.id!, { message, timestamp: Date.now() });

                // Send message
                this.vscode.postMessage(message);

                // Clear timeout and resolve (we don't wait for response in this implementation)
                clearTimeout(timeoutId);
                this.pendingMessages.delete(message.id!);
                resolve();
            } catch (error) {
                this.pendingMessages.delete(message.id!);
                reject(error);
            }
        });
    }

    /**
     * Queue a message for later sending
     * @param message - Message to queue
     */
    private queueMessage(message: WebviewToExtensionMessage): void {
        this.messageQueue.push(message);
        console.log(`Message queued: ${message.type} (queue size: ${this.messageQueue.length})`);
    }

    /**
     * Handle send errors with retry logic
     * @param message - Failed message
     * @param error - Error that occurred
     */
    private handleSendError(message: WebviewToExtensionMessage, error: any): void {
        const messageId = message.id!;
        const currentAttempts = this.retryAttempts.get(messageId) || 0;

        if (currentAttempts < this.maxRetries) {
            // Retry after delay
            this.retryAttempts.set(messageId, currentAttempts + 1);
            setTimeout(() => {
                console.log(`Retrying message ${messageId} (attempt ${currentAttempts + 1}/${this.maxRetries})`);
                this.sendMessage(message);
            }, this.retryDelay * Math.pow(2, currentAttempts)); // Exponential backoff
        } else {
            // Max retries reached
            console.error(`Failed to send message after ${this.maxRetries} attempts:`, message);
            this.retryAttempts.delete(messageId);
            
            // Notify user of communication failure
            this.notifyConnectionError(error);
        }
    }

    /**
     * Set up error handling for connection issues
     */
    private setupErrorHandling(): void {
        // Monitor connection status
        window.addEventListener('online', () => {
            console.log('Connection restored');
            this.isOnline = true;
            this.processMessageQueue();
        });

        window.addEventListener('offline', () => {
            console.log('Connection lost');
            this.isOnline = false;
        });

        // Handle global errors
        window.addEventListener('error', (event: any) => {
            console.error('Global error in webview:', event.error);
            this.sendError({
                message: event.error?.message || 'Unknown error',
                stack: event.error?.stack,
                context: {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno
                }
            }).catch(err => {
                console.error('Failed to send error message:', err);
            });
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event: any) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.sendError({
                message: event.reason?.message || 'Unhandled promise rejection',
                stack: event.reason?.stack,
                context: { type: 'unhandledrejection' }
            }).catch(err => {
                console.error('Failed to send error message:', err);
            });
        });
    }

    /**
     * Start the message queue processor
     */
    private startMessageQueueProcessor(): void {
        setInterval(() => {
            if (this.isOnline && this.messageQueue.length > 0) {
                this.processMessageQueue();
            }
            this.cleanupPendingMessages();
        }, 1000);
    }

    /**
     * Process queued messages
     */
    private processMessageQueue(): void {
        const messagesToProcess = [...this.messageQueue];
        this.messageQueue = [];

        messagesToProcess.forEach(message => {
            this.sendMessage(message).catch(error => {
                console.error('Error processing queued message:', error);
            });
        });
    }

    /**
     * Clean up old pending messages
     */
    private cleanupPendingMessages(): void {
        const now = Date.now();
        for (const [id, { timestamp }] of this.pendingMessages.entries()) {
            if (now - timestamp > this.messageTimeout) {
                console.warn(`Cleaning up expired pending message: ${id}`);
                this.pendingMessages.delete(id);
            }
        }
    }

    /**
     * Notify user of connection errors
     * @param error - Connection error
     */
    private notifyConnectionError(error: any): void {
        // This would typically show a user-visible error message
        console.error('Communication with extension failed:', error);
        
        // Dispatch custom event for UI to handle
        window.dispatchEvent(new (window as any).CustomEvent('connectionError', {
            detail: {
                message: 'Failed to communicate with extension',
                error: error
            }
        }));
    }

    /**
     * Get current queue status
     */
    public getQueueStatus(): { queueSize: number; pendingCount: number; isOnline: boolean } {
        return {
            queueSize: this.messageQueue.length,
            pendingCount: this.pendingMessages.size,
            isOnline: this.isOnline
        };
    }

    /**
     * Clear all queued and pending messages
     */
    public clearQueue(): void {
        this.messageQueue = [];
        this.pendingMessages.clear();
        this.retryAttempts.clear();
    }
}

/**
 * ExtensionMessageHandler class for handling messages received from extension
 * Provides message validation and error recovery
 */
export class ExtensionMessageHandler {
    private messageHandlers: Map<string, (message: ExtensionToWebviewMessage) => void> = new Map();
    private errorHandler?: (error: any) => void;

    constructor() {
        this.setupMessageListener();
    }

    /**
     * Register a handler for a specific message type
     * @param type - Message type to handle
     * @param handler - Handler function
     */
    public onMessage(type: string, handler: (message: ExtensionToWebviewMessage) => void): void {
        this.messageHandlers.set(type, handler);
    }

    /**
     * Register an error handler
     * @param handler - Error handler function
     */
    public onError(handler: (error: any) => void): void {
        this.errorHandler = handler;
    }

    /**
     * Set up the main message listener
     */
    private setupMessageListener(): void {
        window.addEventListener('message', (event: any) => {
            try {
                const message = event.data as ExtensionToWebviewMessage;
                
                // Validate message
                if (!MessageValidator.isValidExtensionMessage(message)) {
                    throw new Error(`Invalid message received: ${JSON.stringify(message)}`);
                }

                // Route message to appropriate handler
                const handler = this.messageHandlers.get(message.type);
                if (handler) {
                    handler(message);
                } else {
                    console.warn(`No handler registered for message type: ${message.type}`);
                }
            } catch (error) {
                console.error('Error handling message from extension:', error);
                if (this.errorHandler) {
                    this.errorHandler(error);
                }
            }
        });
    }

    /**
     * Remove a message handler
     * @param type - Message type to remove handler for
     */
    public removeHandler(type: string): void {
        this.messageHandlers.delete(type);
    }

    /**
     * Get all registered message types
     */
    public getRegisteredTypes(): string[] {
        return Array.from(this.messageHandlers.keys());
    }
}