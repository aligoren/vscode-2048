/**
 * Mock implementation of VSCode API for testing
 */

export const Uri = {
    file: (path: string) => ({ fsPath: path, path }),
    joinPath: (base: any, ...paths: string[]) => ({ fsPath: `${base.fsPath}/${paths.join('/')}`, path: `${base.path}/${paths.join('/')}` })
};

export const ColorThemeKind = {
    Light: 1,
    Dark: 2,
    HighContrast: 3,
    HighContrastLight: 4
};

export const window = {
    activeColorTheme: {
        kind: ColorThemeKind.Dark
    },
    showErrorMessage: () => Promise.resolve(),
    showInformationMessage: () => Promise.resolve(),
    onDidChangeActiveColorTheme: () => ({ dispose: () => {} })
};

export const commands = {
    executeCommand: () => Promise.resolve(),
    registerCommand: () => ({ dispose: () => {} })
};

export const workspace = {
    getConfiguration: () => ({
        get: () => undefined,
        update: () => Promise.resolve()
    })
};

export const ExtensionContext = class {
    extensionUri = Uri.file('/test/extension');
    globalState = {
        get: () => undefined,
        update: () => Promise.resolve()
    };
    subscriptions: any[] = [];
};

export const WebviewViewProvider = class {
    static readonly viewType = 'test';
};

export const CancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested: () => ({ dispose: () => {} })
};

export const WebviewViewResolveContext = {};

export const WebviewView = class {
    webview = {
        postMessage: () => Promise.resolve(),
        onDidReceiveMessage: () => ({ dispose: () => {} }),
        html: '',
        options: {}
    };
    onDidDispose = () => ({ dispose: () => {} });
    onDidChangeVisibility = () => ({ dispose: () => {} });
};

export default {
    Uri,
    ColorThemeKind,
    window,
    commands,
    workspace,
    ExtensionContext,
    WebviewViewProvider,
    CancellationToken,
    WebviewViewResolveContext,
    WebviewView
};