import sys

path = "vscode-extension/src/chatProvider.ts"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

start_index = -1
end_index = -1

for i, line in enumerate(lines):
    if "private async _handleResolveAction" in line:
        # We want to replace everything from the check at 1232 or so
        # Actually let's replace starting from the workspaceRoot check at 1242
        start_index = i + 33 # Approximate start of if (action.action === 'run_command') or try {
        # Better: find try {
        for j in range(i, i + 100):
            if "try {" in lines[j] and "const isUndo = decision === 'undo';" in lines[j+1]:
                start_index = j
                break
        break

if start_index == -1:
    print("Could not find start of try block in _handleResolveAction")
    sys.exit(1)

# Find the end of the method
for i in range(start_index, len(lines)):
    # The end of the method is usually followed by another method or the end of class
    if "} catch (err) {" in lines[i] and i > start_index + 100:
        # Find the closing brace of catch and then method
        for j in range(i, i + 20):
            if lines[j].strip() == "}" and lines[j+1].strip() == "}":
                end_index = j + 2
                break
        break

if end_index == -1:
    print("Could not find end of _handleResolveAction")
    sys.exit(1)

new_method_body = """    try {
      const isUndo = decision === 'undo';

      if (action.action === 'run_command') {
        const cfg = vscode.workspace.getConfiguration('codeAlchemist');
        let allowCommands = cfg.get<string>('allowCommands') || 'ask';

        // 1. Check if the user already approved this via the Webview buttons
        const isActuallyApproved = decision === 'accept' || decision === 'always' || allowCommands === 'always';

        // Always show command details in webview
        this._view.webview.postMessage({
          command: 'stream_chunk',
          requestId: this._activeRequestId,
          text: `\\n🔧 **Komut:** \\`${action.command}\\`\\n   **Dizin:** ${action.cwd || workspaceRoot}\\n`,
        });

        if (allowCommands === 'never' && !isActuallyApproved) {
          this._view.webview.postMessage({
            command: 'action_result',
            actionId,
            status: 'rejected',
            message: 'Komut çalıştırma ayarlarda devre dışı (Never).',
          });
          return;
        }

        if (!isActuallyApproved && allowCommands !== 'always') {
          // 'ask' mode — require explicit approval with Always Allow option
          const confirmed = await vscode.window.showWarningMessage(
            `CodeAlchemist bu komutu çalıştırmak istiyor:\\n\\n${action.command}\\n\\nÇalışma Dizini: ${action.cwd || 'workspace root'}`,
            { modal: true },
            'İzin Ver',
            'Her Zaman İzin Ver',
            'Reddet',
          );

          if (confirmed === 'Reddet' || confirmed === undefined) {
            this._view.webview.postMessage({
              command: 'action_result',
              actionId,
              status: 'rejected',
              message: `Komut reddedildi: ${action.command}`,
            });
            return;
          }

          if (confirmed === 'Her Zaman İzin Ver') {
            await cfg.update('allowCommands', 'always', vscode.ConfigurationTarget.Global);
            allowCommands = 'always';
            this._view.webview.postMessage({
              command: 'stream_chunk',
              requestId: this._activeRequestId,
              text: `\\n🔓 Komut çalıştırma güveni \"Her Zaman\" olarak güncellendi.\\n`,
            });
          }
        } else if (decision === 'always') {
            // User clicked \"Always run\" in the webview
            await cfg.update('allowCommands', 'always', vscode.ConfigurationTarget.Global);
            this._view.webview.postMessage({
                command: 'stream_chunk',
                requestId: this._activeRequestId,
                text: `\\n🔓 Komut çalıştırma güveni \"Her Zaman\" olarak güncellendi.\\n`,
            });
        }

        // Show non-blocking notification if not background
        if (!action.background) {
          vscode.window.showInformationMessage(
            `CodeAlchemist: Çalıştırılıyor: ${action.command}`,
            'Terminale Git'
          ).then(sel => {
            if (sel === 'Terminale Git') {
              vscode.commands.executeCommand('workbench.action.terminal.focus');
            }
          });
        }

        let executionOutput = '';
        let exitCode = 0;
        let execCwd = action.cwd || workspaceRoot;

        try {
          if (action.background) {
            this._output.appendLine(`[Background Execution] ${action.command}`);
            const execution = await this._runCommandInBackground(workspaceRoot, action.command, action.cwd);
            executionOutput = execution.output;
            execCwd = execution.cwd;
            this._output.appendLine(`[Background Output] ${executionOutput}`);
          } else {
            const execution = await this._runCommandInTerminal(workspaceRoot, action.command, action.cwd);
            execCwd = execution.cwd;
            executionOutput = \"Output displayed securely in VS Code Integrated Terminal.\";
          }
        } catch (err: any) {
          executionOutput = err.message || String(err);
          exitCode = err.code || 1;
        }

        this._view.webview.postMessage({
          command: 'action_result',
          actionId,
          status: exitCode === 0 ? 'applied' : 'error',
          message: exitCode === 0 
            ? `✅ Komut çalıştırıldı (${execCwd}): ${action.command}`
            : `❌ Komut hatası (${execCwd}): ${action.command}`,
          outputText: executionOutput,
          exitCode: exitCode
        });
        return;
      }

      if (action.action === 'delete_file') {
        if (isUndo) {
          if (action.originalExists === false) {
            this._view.webview.postMessage({
              command: 'action_result',
              actionId,
              status: 'error',
              message: `Geri alma için kaynak içerik bulunamadı: ${action.file}`,
            });
            return;
          }
          await applyFileEdit(workspaceRoot, {
            file: action.file,
            content: typeof action.originalContent === 'string' ? action.originalContent : '',
            operation: 'replace',
            trust_id: action.trust_id,
            trust_scope: action.trust_scope,
          });
          this._view.webview.postMessage({
            command: 'action_result',
            actionId,
            status: 'reverted',
            message: `Geri alındı: ${action.file}`,
          });
          return;
        }

        const absPath = path.resolve(workspaceRoot, action.file);
        await vscode.workspace.fs.delete(vscode.Uri.file(absPath), { recursive: false, useTrash: true });
        this._view.webview.postMessage({
          command: 'action_result',
          actionId,
          status: 'applied',
          message: `Silindi: ${action.file}`,
        });
        return;
      }

      const revertChange = isUndo
        ? {
            file: action.file,
            content: typeof action.originalContent === 'string' ? action.originalContent : '',
            operation: 'replace',
            trust_id: action.trust_id,
            trust_scope: action.trust_scope,
          }
        : {
            file: action.file,
            content: action.content,
            operation: action.operation,
            trust_id: action.trust_id,
            trust_scope: action.trust_scope,
          };

      if (isUndo && action.originalExists === false) {
        const absPath = path.resolve(workspaceRoot, action.file);
        await vscode.workspace.fs.delete(vscode.Uri.file(absPath), { recursive: false, useTrash: true });
        this._view.webview.postMessage({
          command: 'action_result',
          actionId,
          status: 'reverted',
          message: `Geri alındı: ${action.file}`,
        });
        return;
      }

      await applyFileEdit(workspaceRoot, revertChange as any);

      this._view.webview.postMessage({
        command: 'action_result',
        actionId,
        status: isUndo ? 'reverted' : 'applied',
        message: isUndo ? `Geri alındı: ${action.file}` : `Uygulandı: ${action.file}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this._view.webview.postMessage({
        command: 'action_result',
        actionId,
        status: 'error',
        message: msg,
      });
    }
  }
"""

lines[start_index:end_index] = [new_method_body]

with open(path, "w", encoding="utf-8") as f:
    f.writelines(lines)

print("Successfully rebuilt _handleResolveAction")
