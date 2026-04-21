/**
 * IntentParser analyzes the user prompt to determine the intended action.
 * It uses a layered approach:
 * 1. Slash commands (/bug, /refactor, etc.) -> Highest confidence (1.0)
 * 2. Regex heuristics -> Medium confidence (0.8)
 * 3. Default fallback -> "general" (0.5)
 */

export interface IntentResult {
  intent: string;
  confidence: number;
  cleanText: string; // The text with the slash command removed
}

export class IntentParser {
  private static readonly SLASH_COMMANDS: Record<string, string> = {
    '/bug': 'debugging',
    '/refactor': 'refactor',
    '/explain': 'explanation',
    '/optimize': 'optimize',
    '/test': 'test',
    '/document': 'document'
  };

  /**
   * Parses the user question to determine the intent.
   * Returns the mapped intent identifier, the confidence score, 
   * and a cleaned version of the text if a slash command was successfully parsed.
   */
  public static parse(question: string): IntentResult {
    const q = (question || '').trim();
    const qLower = q.toLowerCase();

    // 1. Check for Slash Commands (Priority 1)
    for (const [cmd, intentValue] of Object.entries(this.SLASH_COMMANDS)) {
      if (qLower.startsWith(cmd)) {
        // Remove the command from the text for cleaner context, unless it's the only thing there
        let cleanText = q.substring(cmd.length).trim();
        if (!cleanText) {
          cleanText = q; // Fallback to raw text if nothing is left
        }
        return {
          intent: intentValue,
          confidence: 1.0,
          cleanText: cleanText
        };
      }
    }

    // 2. Check for Regex Heuristics (Priority 2)
    const editPattern = /\b(edit|modify|change|update|fix|correct|replace|düzenle|degistir|değiştir|güncelle|guncelle|düzelt|duzelt|tamir|hata)\b/;
    const bugPattern = /\b(bug|error|hata|çalışmıyor|calismiyor|fail|exception)\b/;
    const analysisPattern = /\b(incele|analiz|analyze|analysis|review|degerlendir|değerlendir|neden|why|explain|açıkla|ozet|özet|summarize|yorumla)\b/;
    const refactorPattern = /\b(refactor|optimize|iyileştir|iyilestir)\b/;

    if (bugPattern.test(qLower)) {
      return { intent: 'debugging', confidence: 0.8, cleanText: q };
    }
    if (refactorPattern.test(qLower)) {
      return { intent: 'refactor', confidence: 0.8, cleanText: q };
    }
    if (editPattern.test(qLower)) {
      return { intent: 'coding', confidence: 0.8, cleanText: q };
    }
    if (analysisPattern.test(qLower)) {
      return { intent: 'explanation', confidence: 0.8, cleanText: q };
    }

    // 3. General Fallback
    return {
      intent: 'general',
      confidence: 0.5,
      cleanText: q
    };
  }
}
