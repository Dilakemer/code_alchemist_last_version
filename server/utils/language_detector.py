
import os
from google import genai as google_genai

class LanguageDetector:
    """
    Detects the programming language of a given text or code snippet.
    Uses keyword matching as a fast first pass, and falls back to Gemini
    if the confidence is low or for ambiguity.
    """
    
    # Static list of language keywords for fast detection
    LANG_KEYWORDS = {
        'python': ['def ', 'import ', 'print(', 'numpy', 'pandas', 'flask', 'django', 'pip install', 'venv', 'python', 'if __name__ ==', 'try:', 'except:', 'elif ', 'async def', 'await ', 'List[', 'Dict[', 'Optional[', 'fastapi', 'sqlalchemy', 'pytest', 'requirements.txt'],
        'javascript': ['const ', 'let ', 'var ', 'function', 'console.log', '=>', 'react', 'next.js', 'node.js', 'npm', 'yarn', 'jsx', 'javascript', 'js', 'document.get', 'window.', 'async ', 'await ', 'export ', 'import ', 'default ', 'useEffect', 'useState', 'axios', 'express', 'package.json'],
        'typescript': ['interface ', 'type ', 'readonly ', 'enum ', 'namespace ', 'as ', 'is ', 'satisfies', 'unknown', 'any', 'never', 'private ', 'public ', 'protected ', 'implements ', 'extends ', 'tsx', 'typescript', 'ts', ': number', ': string', ': boolean', ': any', ': void', ': never', 'Array<', 'Promise<', 'Record<', 'Partial<'],
        'java': ['public class', 'class ', 'system.out.println', 'psvm', 'maven', 'gradle', 'spring boot', 'java', 'javada', 'public static void', 'extends ', 'implements ', '@Autowired', '@RestController', '@Service'],
        'csharp': ['namespace', 'using system', 'console.writeline', 'public static void', 'c#', 'dotnet', '.net', 'var ', 'async task', 'yield return', 'public override'],
        'cpp': ['#include', 'std::cout', 'int main', 'c++', 'cpp', 'std::vector', 'std::string', 'using namespace std;', 'std::endl', 'iostream'],
        'c': ['#include <stdio.h>', 'printf', 'scanf', 'malloc', 'struct', 'int main', 'void main', 'c languge', 'c dili', 'exit(0)'],
        'html': ['<!doctype html>', '<html>', '<div>', '<body>', 'html', '<head>', '<script>', '<style>', '<a>', '<img>', '<span>', '<ul>', '<li>', '<footer>', '<header>'],
        'css': ['body {', 'margin:', 'padding:', 'color:', 'css', 'background-color:', 'font-size:', '.class', '#id', 'display: flex', 'display: grid', 'position: relative', '@media'],
        'sql': ['select ', 'from ', 'where ', 'insert into', 'update ', 'delete from', 'sql', 'create table', 'join ', 'group by', 'order by', 'count(', 'sum(', 'primary key'],
        'bash': ['sudo ', 'apt-get', 'docker', 'kubectl', 'git ', 'bash', 'shell', 'echo ', 'ls -', 'cd ', 'mkdir ', 'rm -rf', 'chown ', 'chmod '],
        'go': ['func ', 'package main', 'fmt.println', 'go func', 'struct', 'interface', 'chan ', 'defer ', 'select {'],
        'rust': ['fn ', 'let mut', 'println!', 'impl', 'struct', 'enum', 'match ', 'use std::', 'cargo', 'unwrap()'],
        'php': ['<?php', 'echo', '$', 'function', 'class', 'public function', 'composer', 'laravel', 'symfony', 'mysqli_'],
        'ruby': ['def ', 'end', 'puts', 'class ', 'module ', 'require', 'gem install', 'rails', 'attr_accessor'],
        'swift': ['func ', 'var ', 'let ', 'class ', 'struct ', 'import uikit', 'swiftui', 'guard let', '@State'],
        'kotlin': ['fun ', 'val ', 'var ', 'class ', 'data class', 'import kotlin', 'suspend fun', 'lateinit var']
    }

    def __init__(self, gemini_api_key=None):
        self.gemini_api_key = gemini_api_key
        self.client = None
        if self.gemini_api_key:
            self.client = google_genai.Client(api_key=self.gemini_api_key)

    def detect(self, text: str, code: str = "") -> str:
        """
        Detects language from text and code.
        Returns the language name in lowercase or 'unknown'.
        """
        # Combine text and code for analysis
        content = (text + "\n" + code).lower()
        
        # 1. Keyword Matching (Fast)
        scores = {lang: 0 for lang in self.LANG_KEYWORDS}
        for lang, keywords in self.LANG_KEYWORDS.items():
            for keyword in keywords:
                if keyword in content:
                    # Give higher weight to TS and Python specifically to distinguish from JS
                    weight = 2 if lang in ['typescript', 'python'] else 1
                    scores[lang] += weight
        
        # Determine best match
        best_lang = max(scores, key=scores.get)
        max_score = scores[best_lang]
        
        # If javascript and typescript are tied or close, prefer typescript if it has any matches
        if (best_lang == 'javascript' or best_lang == 'typescript') and scores['typescript'] > 0:
            if scores['typescript'] >= (scores['javascript'] - 1):
                best_lang = 'typescript'
                max_score = scores[best_lang]
        
        # Threshold: At least 2 points for a confident keyword match
        if max_score >= 2:
            return best_lang
            
        # 2. Fallback to Gemini (Smart)
        return self._detect_with_llm(content)

    def _detect_with_llm(self, content: str) -> str:
        if not self.gemini_api_key or not self.client:
            return "unknown"
            
        prompt = f"""
        Identify the programming language of the following text/code. 
        If it's natural language without code, return 'natural'.
        If it's pseudo-code or generic algorithm, return 'pseudo'.
        
        Return ONLY the language name in lowercase (e.g. python, java, javascript).
        
        Text sample: 
        {content[:1000]}
        """

        # Strategy: Gemini 2.5 Flash Lite (10 RPM, highest quota) -> Gemini 2.5 Flash (5 RPM)
        for m_name in ['models/gemini-2.5-flash-lite', 'models/gemini-2.5-flash']:
            try:
                result = self.client.models.generate_content(
                    model=m_name.replace('models/', '', 1),
                    contents=prompt
                )
                detected = getattr(result, "text", "unknown").strip().lower()
                
                # Clean up response
                detected = detected.replace("'", "").replace('"', '').replace('.', '')
                
                # Allow common variations
                mapping = {
                    'js': 'javascript',
                    'node': 'javascript',
                    'nodejs': 'javascript',
                    'py': 'python',
                    'c#': 'csharp',
                    'c++': 'cpp',
                    'shell': 'bash',
                    'goland': 'go',
                    'golang': 'go'
                }
                
                return mapping.get(detected, detected)
            except Exception as e:
                if "429" in str(e) or "quota" in str(e).lower():
                    print(f"Gemini {m_name} quota hit, trying next model...")
                    continue
                print(f"Language detection API error with {m_name}: {e}")
                # Try next model anyway if possible
                continue

        return "unknown"
