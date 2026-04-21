import * as vscode from 'vscode';

/**
 * DiagnosticsCollector collects any current errors, warnings, or hints
 * from the active VS Code editor to feed into the AI context for better
 * prompt optimization when bug fixing is requested.
 */
export class DiagnosticsCollector {
  /**
   * Retrieves diagnostics for the specified file URI.
   * If 'onlyErrors' is true, returns only error severities.
   * Format the output to a readable string format to be appended to the user prompt or context.
   */
  public static async collectForActiveFile(uri: vscode.Uri, onlyErrors = false): Promise<string> {
    const allDiagnostics = vscode.languages.getDiagnostics(uri);
    
    if (!allDiagnostics || allDiagnostics.length === 0) {
      return '';
    }

    const filtered = onlyErrors
      ? allDiagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error)
      : allDiagnostics;

    if (filtered.length === 0) {
      return '';
    }

    let output = '\n--- Linter/Compiler Diagnostics ---\n';
    for (const diag of filtered) {
      const severityStr = this.severityToString(diag.severity);
      const line = diag.range.start.line + 1;
      const char = diag.range.start.character + 1;
      output += `[${severityStr}] Line ${line}:${char} - ${diag.message}\n`;
    }
    output += '-----------------------------------\n';

    return output;
  }

  private static severityToString(severity: vscode.DiagnosticSeverity): string {
    switch (severity) {
      case vscode.DiagnosticSeverity.Error:
        return 'ERROR';
      case vscode.DiagnosticSeverity.Warning:
        return 'WARNING';
      case vscode.DiagnosticSeverity.Information:
        return 'INFO';
      case vscode.DiagnosticSeverity.Hint:
        return 'HINT';
      default:
        return 'UNKNOWN';
    }
  }
}
