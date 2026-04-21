import * as vscode from 'vscode';
import { BackendHealthStatus } from './types.js';
import { deriveHealthUrl, pingBackend } from './apiClient.js';

/**
 * Singleton Health Monitor for CodeAlchemist Backend.
 * Uses a hybrid approach:
 * 1. Passive polling (30s)
 * 2. Active checks triggered by user actions or errors.
 */
export class HealthMonitor {
  private static instance: HealthMonitor;
  private _status: BackendHealthStatus = 'connecting';
  private _onStateChange = new vscode.EventEmitter<BackendHealthStatus>();
  private _output?: vscode.OutputChannel;
  private _pollTimer?: NodeJS.Timeout;

  public readonly onStateChange = this._onStateChange.event;

  private constructor() {
    this.startPolling();
  }

  public static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  /**
   * Optional: attach an output channel for logging.
   */
  public setOutput(output: vscode.OutputChannel) {
    this._output = output;
  }

  public get status(): BackendHealthStatus {
    return this._status;
  }

  /**
   * Immediate health check.
   */
  public async checkNow(): Promise<void> {
    const config = vscode.workspace.getConfiguration('codeAlchemist');
    const endpoint = config.get<string>('endpoint') || '';
    
    if (!endpoint) {
      this._output?.appendLine('[Health] Offline: No endpoint configured.');
      this.setStatus('offline');
      return;
    }

    const healthUrl = deriveHealthUrl(endpoint);
    this._output?.appendLine(`[Health] Checking: ${healthUrl || endpoint}...`);
    const isAlive = await pingBackend(endpoint);
    
    if (isAlive) {
      this._output?.appendLine('[Health] Online');
    } else {
      this._output?.appendLine(`[Health] Offline (ping failed for ${healthUrl || endpoint})`);
    }
    
    this.setStatus(isAlive ? 'online' : 'offline');
  }

  private setStatus(newStatus: BackendHealthStatus) {
    if (this._status !== newStatus) {
      this._output?.appendLine(`[Health] Status changed: ${this._status} -> ${newStatus}`);
      this._status = newStatus;
      this._onStateChange.fire(newStatus);
    }
  }

  /**
   * Starts the 30s passive polling loop.
   */
  public startPolling() {
    this.stopPolling();
    // Immediate check on start
    void this.checkNow();
    this._pollTimer = setInterval(() => {
      void this.checkNow();
    }, 30000);
  }

  public stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = undefined;
    }
  }

  /**
   * Call this when a network request fails immediately.
   */
  public notifyFetchError() {
    this.setStatus('offline');
    // Trigger an immediate check with a small delay to see if it recovered
    setTimeout(() => void this.checkNow(), 5000);
  }
}
