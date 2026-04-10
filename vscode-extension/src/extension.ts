import * as vscode from 'vscode';

type AskResponse = {
  answer?: string;
  error?: string;
  details?: string;
};

const API_KEY_SECRET_NAME = 'codeAlchemist.apiKey';

async function readApiKey(context: vscode.ExtensionContext): Promise<string> {
  const fromSecrets = (await context.secrets.get(API_KEY_SECRET_NAME))?.trim();
  if (fromSecrets) {
    return fromSecrets;
  }

  // Backward compatibility: migrate legacy key from settings to SecretStorage.
  const fromSettings = (vscode.workspace.getConfiguration('codeAlchemist').get<string>('apiKey') || '').trim();
  if (fromSettings) {
    await context.secrets.store(API_KEY_SECRET_NAME, fromSettings);
    await vscode.workspace
      .getConfiguration('codeAlchemist')
      .update('apiKey', '', vscode.ConfigurationTarget.Global);
    return fromSettings;
  }

  return '';
}

async function streamSseToOutput(res: Response, output: vscode.OutputChannel): Promise<string> {
  const body = res.body;
  if (!body) {
    return '';
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let fullAnswer = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data:')) {
        continue;
      }

      const raw = line.slice(5).trim();
      if (!raw || raw === '[DONE]') {
        continue;
      }

      try {
        const parsed = JSON.parse(raw) as {
          text?: string;
          chunk?: string;
          delta?: string;
          answer?: string;
          done?: boolean;
        };
        if (parsed.done) {
          continue;
        }
        const chunk = parsed.chunk ?? parsed.text ?? parsed.delta ?? parsed.answer ?? '';
        if (chunk) {
          fullAnswer += chunk;
          output.append(chunk);
        }
      } catch {
        fullAnswer += raw;
        output.append(raw);
      }
    }
  }

  if (buffer.startsWith('data:')) {
    const trailing = buffer.slice(5).trim();
    if (trailing && trailing !== '[DONE]') {
      try {
        const parsed = JSON.parse(trailing) as {
          text?: string;
          chunk?: string;
          delta?: string;
          answer?: string;
          done?: boolean;
        };
        if (!parsed.done) {
          const chunk = parsed.chunk ?? parsed.text ?? parsed.delta ?? parsed.answer ?? '';
          if (chunk) {
            fullAnswer += chunk;
            output.append(chunk);
          }
        }
      } catch {
        fullAnswer += trailing;
        output.append(trailing);
      }
    }
  }

  return fullAnswer;
}

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('CodeAlchemist');

  const setApiKeyCmd = vscode.commands.registerCommand('codeAlchemist.setApiKey', async () => {
    const current = await context.secrets.get(API_KEY_SECRET_NAME) || '';
    const next = await vscode.window.showInputBox({
      title: 'CodeAlchemist API Key',
      prompt: 'Paste your ca-... API key',
      password: true,
      value: current,
      ignoreFocusOut: true,
    });
    if (typeof next !== 'string') return;

    const trimmed = next.trim();
    if (!trimmed) {
      await context.secrets.delete(API_KEY_SECRET_NAME);
      vscode.window.showInformationMessage('CodeAlchemist API key removed from SecretStorage.');
      return;
    }

    await context.secrets.store(API_KEY_SECRET_NAME, trimmed);
    await vscode.workspace
      .getConfiguration('codeAlchemist')
      .update('apiKey', '', vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage('CodeAlchemist API key saved in SecretStorage.');
  });

  const askCmd = vscode.commands.registerCommand('codeAlchemist.ask', async () => {
    const cfg = vscode.workspace.getConfiguration('codeAlchemist');
    const apiKey = await readApiKey(context);
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
          'Accept': 'text/event-stream, application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          question,
          code: selectedText,
        }),
      });

      output.appendLine('');
      output.appendLine(`Status: ${res.status} ${res.statusText}`);
      output.appendLine('');

      const contentType = (res.headers.get('content-type') || '').toLowerCase();

      if (!res.ok) {
        const errorText = await res.text();
        let errorData: AskResponse = {};
        try {
          errorData = JSON.parse(errorText) as AskResponse;
        } catch {
          // leave as raw
        }
        output.appendLine(typeof errorData === 'object' ? JSON.stringify(errorData, null, 2) : errorText);
        vscode.window.showErrorMessage(`CodeAlchemist request failed (${res.status}). See Output → CodeAlchemist.`);
        return;
      }

      if (contentType.includes('text/event-stream')) {
        output.appendLine('Streaming response:');
        const streamedText = await streamSseToOutput(res, output);
        if (!streamedText.trim()) {
          output.appendLine('[No streamed text received]');
        }
        output.appendLine('');
      } else {
        const text = await res.text();
        let data: AskResponse = {};
        try {
          data = JSON.parse(text) as AskResponse;
        } catch {
          // leave as raw
        }
        const answer = data.answer ?? text;
        output.appendLine(answer);
      }

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

