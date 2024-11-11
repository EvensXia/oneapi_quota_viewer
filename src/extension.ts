import * as vscode from 'vscode';
import * as oneapi from './OneAPI';

export function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel("OneapiQuotaViewer");
    context.subscriptions.push(outputChannel);

    // 添加命令来手动激活插件
    const activateCommand = vscode.commands.registerCommand('oneapi-quota-viewer.activate', () => {
        outputChannel.appendLine('Activating OneAPI Quota Viewer...');
        initializePlugin(context, outputChannel);
    });

    context.subscriptions.push(activateCommand);

    // 自动激活插件
    initializePlugin(context, outputChannel);
}

function initializePlugin(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
    outputChannel.appendLine('Congratulations, your extension "OneapiQuotaViewer" is now active!');
    console.log('Congratulations, your extension "OneapiQuotaViewer" is now active!');

    const config = vscode.workspace.getConfiguration('oneapi_quota_viewer');
    const domain = config.get<string>('domain', '');
    const accessToken = config.get<string>('token', '');
    const refreshInterval = config.get<number>('refreshInterval', 30);

    if (!domain) {
        outputChannel.appendLine("Error: Domain not set in configuration.");
    } else {
        outputChannel.appendLine(`Domain set to: ${domain}`);
    }

    if (!accessToken) {
        outputChannel.appendLine("Error: Access token not set in configuration. Please set oneapi.token in your settings.");
    } else {
        outputChannel.appendLine(`Access token set to: ${accessToken}`);
    }

    if (!refreshInterval || refreshInterval <= 0) {
        outputChannel.appendLine("Error: Invalid refresh interval. Using default: 30 seconds.");
    } else {
        outputChannel.appendLine(`Refresh interval set to: ${refreshInterval} seconds`);
    }

    const api = new oneapi.OneAPI(domain, accessToken);

    const updateStatusBar = async () => {
        const data = await api.fetchBalance();
        if (data.success) {
            vscode.window.setStatusBarMessage(`User: ${data.email} | Quota: $${data.quota} | Used Quota: $${data.usedQuota}`);
        } else {
            vscode.window.setStatusBarMessage(`OneAPI Failed to fetch data: ${data.email}`);
            outputChannel.appendLine(`Error fetching data: ${data.email}`);
        }
    };

    updateStatusBar();
    const interval = setInterval(updateStatusBar, (refreshInterval || 30) * 1000);
    context.subscriptions.push({ dispose: () => clearInterval(interval) });
}

export function deactivate() {}
