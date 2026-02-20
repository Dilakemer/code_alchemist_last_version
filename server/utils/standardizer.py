
import autopep8

class CodeStandardizer:
    """
    Standardizes code formatting.
    Currently supports strong PEP8 formatting for Python.
    Other languages are passed through or lightly trimmed.
    """


    @staticmethod
    def standardize(text: str) -> str:
        """
        Standardizes code within a Markdown text.
        Finds ```language ... ``` blocks and formats the code inside.
        """
        if not text or "```" not in text:
            return text

        import re
        
        # Regex to find code blocks: ```(lang)?\n(code)```
        # We use a replacement function to format the content
        
        def replace_block(match):
            full_match = match.group(0)
            lang_tag = match.group(1) or ""
            code_content = match.group(2)
            
            lang = lang_tag.strip().lower()
            
            # Format based on language
            if lang in ['python', 'py']:
                try:
                    formatted = autopep8.fix_code(code_content, options={'aggressive': 1})
                    return f"```{lang_tag}\n{formatted.rstrip()}\n```"
                except:
                    pass
            
            # Default cleanup for other languages (or if python format fails)
            # Trim trailing spaces and ensure clean newlines
            lines = code_content.split('\n')
            cleaned_lines = [line.rstrip() for line in lines]
            new_code = '\n'.join(cleaned_lines).strip()
            
            return f"```{lang_tag}\n{new_code}\n```"

        # Regex: ```(\w+)?\n(.*?)``` (dotall)
        pattern = re.compile(r"```([a-zA-Z0-9+\-#]*)\n(.*?)```", re.DOTALL)
        
        return pattern.sub(replace_block, text)
