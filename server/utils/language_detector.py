
import os
import google.generativeai as genai

class LanguageDetector:
    """
    Detects the programming language of a given text or code snippet.
    Uses keyword matching as a fast first pass, and falls back to Gemini
    if the confidence is low or for ambiguity.
    """
    
    # Static list of language keywords for fast detection
    LANG_KEYWORDS = {
        'python': ['def ', 'import ', 'print(', 'numpy', 'pandas', 'flask', 'django', 'pip install', 'venv', 'python', 'if __name__ ==', 'try:', 'except:'],
        'javascript': ['const ', 'let ', 'var ', 'function', 'console.log', '=>', 'react', 'next.js', 'node.js', 'npm', 'yarn', 'jsx', 'tsx', 'javascript', 'js', 'document.get', 'window.'],
        'java': ['public class', 'class ', 'system.out.println', 'psvm', 'maven', 'gradle', 'spring boot', 'java', 'javada', 'public static void', 'extends ', 'implements '],
        'csharp': ['namespace', 'using system', 'console.writeline', 'public static void', 'c#', 'dotnet', '.net', 'var ', 'async task'],
        'cpp': ['#include', 'std::cout', 'int main', 'c++', 'cpp', 'std::vector', 'std::string', 'using namespace std;'],
        'c': ['#include <stdio.h>', 'printf', 'scanf', 'malloc', 'struct', 'int main', 'void main', 'c languge', 'c dili'],
        'html': ['<!doctype html>', '<html>', '<div>', '<body>', 'html', '<head>', '<script>', '<style>'],
        'css': ['body {', 'margin:', 'padding:', 'color:', 'css', 'background-color:', 'font-size:', '.class', '#id'],
        'sql': ['select ', 'from ', 'where ', 'insert into', 'update ', 'delete from', 'sql', 'create table', 'join ', 'group by'],
        'bash': ['sudo ', 'apt-get', 'docker', 'kubectl', 'git ', 'bash', 'shell', 'echo ', 'ls -', 'cd '],
        'go': ['func ', 'package main', 'fmt.println', 'go func', 'struct', 'interface'],
        'rust': ['fn ', 'let mut', 'println!', 'impl', 'struct', 'enum', 'match '],
        'php': ['<?php', 'echo', '$', 'function', 'class', 'public function', 'composer'],
        'ruby': ['def ', 'end', 'puts', 'class ', 'module ', 'require', 'gem install'],
        'swift': ['func ', 'var ', 'let ', 'class ', 'struct ', 'import uikit', 'swiftui'],
        'kotlin': ['fun ', 'val ', 'var ', 'class ', 'data class', 'import kotlin']
    }

    def __init__(self, gemini_api_key=None):
        self.gemini_api_key = gemini_api_key
        if self.gemini_api_key:
            genai.configure(api_key=self.gemini_api_key)

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
                    # Give slightly more weight to longer keywords as they are more specific
                    scores[lang] += 1
        
        # Determine best match
        best_lang = max(scores, key=scores.get)
        
        # Threshold: At least 2 keyword matches to be confident, 
        # unless it's a very strong unique keyword (handled by logic check or simple count)
        if scores[best_lang] >= 2:
            return best_lang
            
        # 2. Fallback to Gemini (Smart)
        return self._detect_with_llm(content)

    def _detect_with_llm(self, content: str) -> str:
        if not self.gemini_api_key:
            return "unknown"
            
        try:
            # Use Gemini 2.5 Flash Lite or similar fast model
            model = genai.GenerativeModel('models/gemini-2.5-flash-lite')
            prompt = f"""
            Identify the programming language of the following text/code. 
            If it's natural language without code, return 'natural'.
            If it's pseudo-code or generic algorithm, return 'pseudo'.
            
            Return ONLY the language name in lowercase (e.g. python, java, javascript).
            
            Text sample: 
            {content[:1000]}
            """
            result = model.generate_content(prompt)
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
            print(f"Language detection API error: {e}")
            return "unknown"
