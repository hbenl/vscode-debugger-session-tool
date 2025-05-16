## Debugger session tool
This is an experimental VS Code extension to let Copilot run debugger sessions with logpoints to analyze an app's behavior.

### Setup
- clone this repo
- run `npm install`
- open in VS Code
- start a debugger session -> this will open a second VS Code window running this extension
- switch to the second VS Code window and open a web app project in it
- open the Copilot chat, add the debuggerSession tool and the app's sources to its context and ask Copilot a question...

The description of this tool that is given to Copilot can be found in `package.json` under `modelDescription` and the description of its input parameters under `inputSchema`.
