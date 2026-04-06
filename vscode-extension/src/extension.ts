import * as vscode from 'vscode';

type AskResponse = {
  answer?: string;
  error?: string;
  details?: string;
};

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('CodeAlchemist');

  const setApiKeyCmd = vscode.commands.registerCommand('codeAlchemist.setApiKey', async () => {
    const current = vscode.workspace.getConfiguration('codeAlchemist').get<string>('apiKey') || '';
    const next = await vscode.window.showInputBox({
      title: 'CodeAlchemist API Key',
      prompt: 'Paste your ca-... API key',
      password: true,
      value: current,
      ignoreFocusOut: true,
    });
    if (typeof next !== 'string') return;

    await vscode.workspace.getConfiguration('codeAlchemist').update('apiKey', next.trim(), vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage('CodeAlchemist API key saved.');
  });

  const askCmd = vscode.commands.registerCommand('codeAlchemist.ask', async () => {
    const cfg = vscode.workspace.getConfiguration('codeAlchemist');
    const apiKey = (cfg.get<string>('apiKey') || '').trim();
    const endpoint = (cfg.get<string>('endpoint') || '').trim();

    if (!apiKey) {
      vscode.window.showErrorMessage('CodeAlchemist: API key missing. Run “CodeAlchemist: Set API Key”.');
      return;
    }
    if (!endpoint) {
      vscode.window.showErrorMessage('CodeAlchemist: Endpoint is empty. Set codeAlchemist.endpoint in Settings.');
      return;
    }

    const editor = vscode.window.activeTextEditor;
    const selection = editor?.selection;
    const selectedText =
      editor && selection && !selection.isEmpty ? editor.document.getText(selection) : '';

    const question = await vscode.window.showInputBox({
      title: 'Ask CodeAlchemist',
      prompt: selectedText ? 'Question (selected code will be included)' : 'Question',
      ignoreFocusOut: true,
    });
    if (!question) return;

    output.clear();
    output.show(true);
    output.appendLine(`POST ${endpoint}`);
    output.appendLine('');
    output.appendLine(`Question: ${question}`);
    if (selectedText) {
      output.appendLine('');
      output.appendLine('--- Selected code ---');
      output.appendLine(selectedText);
      output.appendLine('---');
    }
    output.appendLine('');
    output.appendLine('Waiting for response...');

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          question,
          code: selectedText,
        }),
      });

      const text = await res.text();
      let data: AskResponse = {};
      try {
        data = JSON.parse(text) as AskResponse;
      } catch {
        // leave as raw
      }

      output.appendLine('');
      output.appendLine(`Status: ${res.status} ${res.statusText}`);
      output.appendLine('');

      if (!res.ok) {
        output.appendLine(typeof data === 'object' ? JSON.stringify(data, null, 2) : text);
        vscode.window.showErrorMessage(`CodeAlchemist request failed (${res.status}). See Output → CodeAlchemist.`);
        return;
      }

      const answer = data.answer ?? text;
      output.appendLine(answer);
      vscode.window.showInformationMessage('CodeAlchemist: answer received (see Output).');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      output.appendLine('');
      output.appendLine(`Error: ${msg}`);
      vscode.window.showErrorMessage('CodeAlchemist request failed. See Output → CodeAlchemist.');
    }
  });

  context.subscriptions.push(output, setApiKeyCmd, askCmd);
}

export function deactivate() {}

