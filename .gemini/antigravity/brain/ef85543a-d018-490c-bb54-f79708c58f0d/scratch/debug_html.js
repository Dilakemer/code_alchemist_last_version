
import * as fs from 'fs';
import * as path from 'path';

// Mocking necessary constants and functions
const SIDEBAR_MODEL_OPTIONS = [
  { value: 'auto', label: 'Auto (Smart Model)' },
  { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite (Preview)' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (Fast)' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (New)' },
  { value: 'gemma-4-26b-a4b-it', label: 'Gemma 4 26B A4B IT (Agent)' },
  { value: 'gemma-4-31b-it', label: 'Gemma 4 31B IT (Agent)' },
  { value: 'gpt-4o', label: 'GPT-4o (OpenAI)' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude 4.5 Sonnet' },
  { value: 'claude-opus-4-5-20251101', label: 'Claude 4.5 Opus' },
];

function escapeForInlineJson(value) {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}

// I need to read the actual getChatWebviewContent from the file but it's complex since it depends on vscode.Webview
// I will just read the file and extract the template literal content.

const chatViewPath = 'c:\\Users\\USER\\OneDrive - BAKIRÇAY ÜNİVERSİTESİ\\Masaüstü\\code_alchemisti\\code_alchemist\\vscode-extension\\src\\chatView.ts';
const content = fs.readFileSync(chatViewPath, 'utf8');

// Extract the template literal
const match = content.match(/return `([\s\S]*)`;/);
if (match) {
    let html = match[1];
    const nonce = 'TEST_NONCE';
    const cspSource = 'vscode-resource:';
    const inlineStateJson = escapeForInlineJson({
        selectedModel: 'auto',
        modelOptions: SIDEBAR_MODEL_OPTIONS
    });

    html = html.replace(/\$\{nonce\}/g, nonce);
    html = html.replace(/\$\{cspSource\}/g, cspSource);
    html = html.replace(/\$\{inlineStateJson\}/g, inlineStateJson);
    
    // Also need to replace path-like interpolations if any
    
    fs.writeFileSync('scratch_debug_view.html', html);
    console.log('Generated scratch_debug_view.html');
} else {
    console.log('Could not find template literal');
}
