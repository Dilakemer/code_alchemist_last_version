import React, { useRef, useState, useCallback, useEffect } from 'react';
import Editor, { loader } from '@monaco-editor/react';

// Explicitly set the source for Monaco assets to ensure reliability
loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.43.0/min/vs' } });

/**
 * MonacoCodeEditor — VS Code motoruyla gelişmiş kod editörü
 */
const LANGUAGES = [
  { label: 'Python', value: 'python' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'JSX/TSX', value: 'typescript' },
  { label: 'Go', value: 'go' },
  { label: 'Rust', value: 'rust' },
  { label: 'Java', value: 'java' },
  { label: 'C/C++', value: 'cpp' },
  { label: 'SQL', value: 'sql' },
  { label: 'HTML', value: 'html' },
  { label: 'CSS', value: 'css' },
  { label: 'JSON', value: 'json' },
  { label: 'Markdown', value: 'markdown' },
  { label: 'Plain Text', value: 'plaintext' },
];

const MonacoCodeEditor = ({
  value = '',
  onChange,
  language = 'python',
  onLanguageChange,
  theme = 'dark',
  height = '200px',
  placeholder = '// Paste or write your code here...',
}) => {
  const editorRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentLang, setCurrentLang] = useState(language);

  // Sync state if prop changes from parent
  React.useEffect(() => {
    if (language !== currentLang) {
      setCurrentLang(language);
    }
  }, [language]);

  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    
    // Auto-focus when mounted
    editor.focus();

    // Register basic snippets for languages that lack default LSP in Monaco
    if (monaco && !window.__monaco_custom_snippets_registered) {
      const registerSnippets = (lang, snippets) => {
        monaco.languages.registerCompletionItemProvider(lang, {
          provideCompletionItems: (model, position) => {
            const word = model.getWordUntilPosition(position);
            const range = {
              startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
              startColumn: word.startColumn, endColumn: word.endColumn,
            };
            return {
              suggestions: snippets.map(s => ({
                label: s.label,
                kind: s.kind || monaco.languages.CompletionItemKind.Keyword,
                insertText: s.insertText,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: s.desc,
                range: range
              }))
            };
          }
        });
      };

      // Python
      registerSnippets('python', [
        { label: 'print', kind: monaco.languages.CompletionItemKind.Function, insertText: 'print(${1:value})', desc: 'Print to console' },
        { label: 'def', insertText: 'def ${1:name}(${2:args}):\n\t${3:pass}', desc: 'Define a function' },
        { label: 'class', insertText: 'class ${1:Name}:\n\tdef __init__(self):\n\t\t${2:pass}', desc: 'Define a class' },
        { label: 'if', insertText: 'if ${1:condition}:\n\t${2:pass}', desc: 'If statement' },
        { label: 'for', insertText: 'for ${1:item} in ${2:iterable}:\n\t${3:pass}', desc: 'For loop' },
        { label: 'import', insertText: 'import ${1:module}', desc: 'Import module' }
      ]);

      // C++ (cpp)
      registerSnippets('cpp', [
        { label: '#include', insertText: '#include <${1:iostream}>', desc: 'Include directive' },
        { label: 'cout', insertText: 'std::cout << ${1:value} << std::endl;', desc: 'Standard output' },
        { label: 'printf', kind: monaco.languages.CompletionItemKind.Function, insertText: 'printf("${1:%d}\\n", ${2:value});', desc: 'Print formatted' },
        { label: 'main', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'int main() {\n\t${1}\n\treturn 0;\n}', desc: 'Main function' },
        { label: 'for', insertText: 'for (int i = 0; i < ${1:count}; i++) {\n\t${2}\n}', desc: 'For loop' },
        { label: 'class', insertText: 'class ${1:Name} {\npublic:\n\t${1}() {}\n};', desc: 'Define a class' }
      ]);

      // Java
      registerSnippets('java', [
        { label: 'sout', insertText: 'System.out.println(${1:value});', desc: 'Print to console' },
        { label: 'main', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'public static void main(String[] args) {\n\t${1}\n}', desc: 'Main method' },
        { label: 'class', insertText: 'public class ${1:Name} {\n\t${2}\n}', desc: 'Public class' },
        { label: 'for', insertText: 'for (int i = 0; i < ${1:count}; i++) {\n\t${2}\n}', desc: 'For loop' },
        { label: 'if', insertText: 'if (${1:condition}) {\n\t${2}\n}', desc: 'If statement' }
      ]);

      // Go
      registerSnippets('go', [
        { label: 'fmt.Println', kind: monaco.languages.CompletionItemKind.Function, insertText: 'fmt.Println(${1:value})', desc: 'Print to console' },
        { label: 'fmt.Printf', kind: monaco.languages.CompletionItemKind.Function, insertText: 'fmt.Printf("${1:%v}\\n", ${2:value})', desc: 'Print formatted' },
        { label: 'func', insertText: 'func ${1:name}(${2:args}) ${3:returnType} {\n\t${4}\n}', desc: 'Function definition' },
        { label: 'main', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'func main() {\n\t${1}\n}', desc: 'Main function' },
        { label: 'for', insertText: 'for ${1:i} := 0; ${1:i} < ${2:count}; ${1:i}++ {\n\t${3}\n}', desc: 'For loop' },
        { label: 'iferr', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'if err != nil {\n\treturn err\n}', desc: 'Error check handling' }
      ]);

      // Rust
      registerSnippets('rust', [
        { label: 'println!', kind: monaco.languages.CompletionItemKind.Function, insertText: 'println!("${1:{}}", ${2:value});', desc: 'Print to console macro' },
        { label: 'fn', insertText: 'fn ${1:name}(${2:args}) -> ${3:ReturnType} {\n\t${4}\n}', desc: 'Function definition' },
        { label: 'main', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'fn main() {\n\t${1}\n}', desc: 'Main function' },
        { label: 'for', insertText: 'for ${1:item} in ${2:iterator} {\n\t${3}\n}', desc: 'For loop' },
        { label: 'struct', insertText: 'struct ${1:Name} {\n\t${2:field}: ${3:Type},\n}', desc: 'Struct definition' }
      ]);

      // SQL
      registerSnippets('sql', [
        { label: 'SELECT', insertText: 'SELECT ${1:*} FROM ${2:table_name};', desc: 'Select statement' },
        { label: 'INSERT', insertText: 'INSERT INTO ${1:table_name} (${2:columns}) VALUES (${3:values});', desc: 'Insert statement' },
        { label: 'UPDATE', insertText: 'UPDATE ${1:table_name} SET ${2:column} = ${3:value} WHERE ${4:condition};', desc: 'Update statement' },
        { label: 'DELETE', insertText: 'DELETE FROM ${1:table_name} WHERE ${2:condition};', desc: 'Delete statement' },
        { label: 'CREATE TABLE', insertText: 'CREATE TABLE ${1:table_name} (\n\t${2:id} INT PRIMARY KEY,\n\t${3:column_name} VARCHAR(255)\n);', desc: 'Create table' }
      ]);

      window.__monaco_custom_snippets_registered = true;
    }

    // Ctrl+Enter → submit shortcut
    editor.addCommand(
      2048 | 3, // Monaco.KeyMod.CtrlCmd | Monaco.KeyCode.Enter
      () => {
        editor.getDomNode()?.dispatchEvent(new CustomEvent('monaco-submit', { bubbles: true }));
      }
    );
  }, []);

  const handleLangChange = (e) => {
    const lang = e.target.value;
    setCurrentLang(lang);
    onLanguageChange?.(lang);
  };

  const editorHeight = isExpanded ? '420px' : height;

  return (
    <div className="rounded-xl overflow-hidden border border-gray-700/60 bg-[#1e1e1e] flex flex-col transition-all duration-300"
      style={{ minHeight: editorHeight }}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900/80 border-b border-gray-700/50">
        <div className="flex items-center gap-2">
          {/* Language selector */}
          <select
            value={currentLang}
            onChange={handleLangChange}
            className="bg-gray-800 border border-gray-700 rounded-md text-xs text-gray-300 px-2 py-1 focus:outline-none focus:border-fuchsia-500 transition-colors"
          >
            {LANGUAGES.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <span className="text-xs text-gray-600 hidden sm:block">Code Editor (Monaco)</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Line count indicator */}
          {value && (
            <span className="text-[10px] text-gray-600 mr-2">
              {value.split('\n').length} lines
            </span>
          )}

          {/* Clear button */}
          {value && (
            <button
              onClick={() => onChange?.('')}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-gray-800"
              title="Clear editor"
            >
              ✕ Clear
            </button>
          )}

          {/* Expand / Collapse */}
          <button
            onClick={() => setIsExpanded(v => !v)}
            className="text-xs text-gray-500 hover:text-fuchsia-400 transition-colors px-2 py-1 rounded hover:bg-gray-800"
            title={isExpanded ? 'Collapse editor' : 'Expand editor'}
          >
            {isExpanded ? '⤡ Collapse' : '⤢ Expand'}
          </button>
        </div>
      </div>

      {/* Monaco Editor */}
      <Editor
        height={editorHeight}
        language={currentLang}
        value={value}
        onChange={(val) => onChange?.(val ?? '')}
        onMount={handleEditorMount}
        theme={theme === 'dark' ? 'vs-dark' : 'light'}
        options={{
          minimap: { enabled: isExpanded },
          fontSize: 13,
          lineHeight: 20,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
          fontLigatures: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          padding: { top: 8, bottom: 8 },
          scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
          lineNumbers: isExpanded ? 'on' : 'on',
          glyphMargin: false,
          folding: isExpanded,
          renderLineHighlight: 'line',
          suggestOnTriggerCharacters: true,
          quickSuggestions: {
            other: true,
            comments: false,
            strings: true
          },
          snippetSuggestions: 'inline',
          suggestSelection: 'first',
          acceptSuggestionOnEnter: 'on',
          suggest: {
            showKeywords: true,
            showSnippets: true,
          },
          placeholder,
        }}
      />
    </div>
  );
};

export default MonacoCodeEditor;
