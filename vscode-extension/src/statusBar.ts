/**
 * Status Bar — manages the CodeAlchemist status bar item with busy indicator.
 *
 * Displays:
 *  - Active model name
 *  - Mode (Agent / Chat)
 *  - Animated spinner while requests are in progress
 *
 * Clicking opens the model selector QuickPick.
 */
import * as vscode from 'vscode';
import type { ModelDefinition } from './types.js';

// ── Status Bar Manager ──────────────────────────────────────────────

export interface StatusBarManager {
  /** The underlying VS Code StatusBarItem. */
  item: vscode.StatusBarItem;
  /** Update the display to reflect current model & agent mode. */
  update(): void;
  /** Set the busy state (shows animated spinner + progress notification). */
  setBusy(busy: boolean): void;
  /** Dispose all resources. */
  dispose(): void;
}

import { HealthMonitor } from './healthMonitor.js';

/**
 * Creates and returns a StatusBarManager.
 *
 * @param models  Available model definitions for label lookup
 */
export function createStatusBar(models: ModelDefinition[]): StatusBarManager {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.command = 'codeAlchemist.selectModel';

  let isBusy = false;
  const healthMonitor = HealthMonitor.getInstance();

  const update = (): void => {
    if (isBusy) {
      // Don't overwrite busy state
      return;
    }

    const health = healthMonitor.status;
    if (health === 'offline') {
      item.text = `$(circle-slash) CodeAlchemist: Offline`;
      item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      item.tooltip = 'CodeAlchemist Backend is unreachable. Check your server or endpoint settings.';
      item.show();
      return;
    }

    const cfg = vscode.workspace.getConfiguration('codeAlchemist');
    const model = cfg.get<string>('model') || 'gemini-2.5-flash';
    const agentMode = cfg.get<boolean>('agentMode') ?? true;
    const modelLabel = models.find(m => m.value === model)?.label || model;
    const shortName = modelLabel.split(' ')[0];

    if (agentMode) {
      item.text = `$(hubot) CodeAlchemist: ${shortName} (Agent)`;
    } else {
      item.text = `$(comment-discussion) CodeAlchemist: ${shortName} (Chat)`;
    }

    item.tooltip = [
      `Model: ${modelLabel}`,
      `Mode: ${agentMode ? 'Agent' : 'Chat'}`,
      `Status: ${health.charAt(0).toUpperCase() + health.slice(1)}`,
      '',
      'Click to change model',
    ].join('\n');

    item.backgroundColor = undefined;
    item.show();
  };

  const healthSub = healthMonitor.onStateChange(() => update());

  const setBusy = (busy: boolean): void => {
    isBusy = busy;
    if (busy) {
      item.text = '$(loading~spin) CodeAlchemist: Processing...';
      item.tooltip = 'CodeAlchemist is processing your request...';
      item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      update();
    }
  };

  const dispose = (): void => {
    healthSub.dispose();
    item.dispose();
  };

  // Initialize
  update();

  return { item, update, setBusy, dispose };
}
