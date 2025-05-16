import * as vscode from 'vscode';
import { DebuggerSessionTool } from './debuggerSessionTool';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.lm.registerTool('debugger-session-tool', new DebuggerSessionTool()));
}

export function deactivate() { }
