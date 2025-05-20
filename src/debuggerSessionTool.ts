import * as vscode from 'vscode';

// the debug adapter to use
const debugAdapterType = 'firefox';

// we add a prefix and suffix to logpoints to distinguish them from other console messages
const logpointPrefix = '--> ';
const logpointSuffix = ' <--';

interface ILogpoint {
	src: string;
	line: number;
	message: string;
}

interface IDebuggerSessionParameters {
	url: string;
	logpoints: ILogpoint[];
	script: string;
}

export class DebuggerSessionTool implements vscode.LanguageModelTool<IDebuggerSessionParameters> {

	prepareInvocation(
		_options: vscode.LanguageModelToolInvocationOptions<IDebuggerSessionParameters>,
		_token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.PreparedToolInvocation> {
		return {
			invocationMessage: 'Running debugger session...',
			confirmationMessages: {
				title: 'Debugger Session',
				message: new vscode.MarkdownString(`Run a debugger session with the following parameters:`),
			}
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IDebuggerSessionParameters>,
		_token: vscode.CancellationToken
	) {
		const logs = await runDebuggerSession(options.input);
		return new vscode.LanguageModelToolResult(logs.map(log => new vscode.LanguageModelTextPart(log)));
	}
}

async function runDebuggerSession(
	params: IDebuggerSessionParameters,
): Promise<string[]> {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		throw new Error('No workspace folder found');
	}

	// temporarily remove any breakpoints set by the user
	const userBreakpoints = vscode.debug.breakpoints;
	if (userBreakpoints.length > 0) {
		vscode.debug.removeBreakpoints(userBreakpoints);
	}

	const logpoints = params.logpoints.map(
		logpoint => new vscode.SourceBreakpoint(
			new vscode.Location(vscode.Uri.joinPath(workspaceFolder.uri, logpoint.src), new vscode.Position(logpoint.line - 1, 0)),
			true,
			undefined,
			undefined,
			logpointPrefix + logpoint.message + logpointSuffix
		)
	);

	vscode.debug.addBreakpoints(logpoints);

	const trackerFactory = new ConsoleMessageTrackerFactory();
	const trackerRegistration = vscode.debug.registerDebugAdapterTrackerFactory(debugAdapterType, trackerFactory);

	let session: vscode.DebugSession | undefined;
	try {
		const sessionStarted = await vscode.debug.startDebugging(workspaceFolder, {
			type: debugAdapterType,
			name: 'Test',
			request: 'launch',
			url: params.url,
		});
		if (!sessionStarted) {
			throw new Error('Failed to start debug session');
		}

		session = vscode.debug.activeDebugSession;
		if (!session) {
			throw new Error('No active debug session found');
		}

		await delay(1000);
		await session.customRequest('evaluate', { expression: params.script });
		await delay(1000);

	} finally {
		if (session) {
			await vscode.debug.stopDebugging(session);
		}
		trackerRegistration.dispose();
		vscode.debug.removeBreakpoints(logpoints);
		vscode.debug.addBreakpoints(userBreakpoints);
	}

	return trackerFactory.logs;
}

interface Message {
    type: string;
    event?: string;
    body?: {
        output?: string;
    }
}

class ConsoleMessageTrackerFactory implements vscode.DebugAdapterTrackerFactory {
    public readonly logs: string[] = [];
    createDebugAdapterTracker(): vscode.ProviderResult<vscode.DebugAdapterTracker> {
        return new ConsoleMessageTracker(this.logs);
    }
}

class ConsoleMessageTracker implements vscode.DebugAdapterTracker {
    constructor(private logs: string[]) {}
    onDidSendMessage(message: Message): void {
        if (message.type === 'event' && message.event === 'output') {
			const output = message.body?.output?.trim();
			if (output && output.startsWith(logpointPrefix) && output.endsWith(logpointSuffix)) {
	            this.logs.push(output.substring(logpointPrefix.length, output.length - logpointSuffix.length));
			}
        }
    }
}

async function delay(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
