
import os

target_file = r'c:\Users\USER\OneDrive - BAKIRÇAY ÜNİVERSİTESİ\Masaüstü\code_alchemisti\code_alchemist\client\src\App.jsx'

if not os.path.exists(target_file):
    print(f"File not found: {target_file}")
    exit(1)

with open(target_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

balance = 0
in_comment = False
for i, line in enumerate(lines):
    line_num = i + 1
    # Simple comment detection
    trimmed = line.strip()
    if trimmed.startswith('/*'): in_comment = True
    if '*/' in trimmed: in_comment = False
    if in_comment or trimmed.startswith('//'): continue
    
    # Remove strings to avoid counting braces inside them
    # This is very crude but might work for simple cases
    temp_line = line
    import re
    temp_line = re.sub(r'["\'].*?["\']', '', temp_line)
    
    for char in temp_line:
        if char == '{':
            balance += 1
        elif char == '}':
            balance -= 1
            if balance == 0:
                print(f"ZERO_LINE_{line_num}: {trimmed}")
            if balance < 0:
                print(f"NEGATIVE_LINE_{line_num}: {trimmed}")
