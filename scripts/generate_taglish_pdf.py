import os
import re

md_path = 'docs/TUTORIAL_TAGLISH.md'
html_path = 'docs/TUTORIAL_TAGLISH.html'
pdf_path = 'docs/TUTORIAL_TAGLISH.pdf'

with open(md_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

html_content = ["""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Gabay sa Paggamit ng Receiving & Delivery App (Daiso Japan)</title>
<style>
  @page {
    size: A4;
    margin: 16mm 14mm 16mm 14mm;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1e1e24;
    line-height: 1.55;
    font-size: 10pt;
    background: #fff;
    margin: 0;
    padding: 0;
  }
  h1 {
    color: #e5005c;
    font-size: 18pt;
    margin-bottom: 3pt;
    border-bottom: 2.5px solid #e5005c;
    padding-bottom: 6pt;
  }
  h2 {
    color: #111;
    font-size: 13pt;
    margin-top: 18pt;
    margin-bottom: 6pt;
    padding-bottom: 4pt;
    border-bottom: 1.5px solid #ff80ab;
    page-break-after: avoid;
    break-after: avoid;
  }
  h3 {
    color: #e5005c;
    font-size: 10.5pt;
    margin-top: 10pt;
    margin-bottom: 4pt;
    page-break-after: avoid;
    break-after: avoid;
  }
  p {
    margin: 4pt 0;
  }
  ul, ol {
    margin: 4pt 0 8pt 20pt;
    padding: 0;
  }
  li {
    margin-bottom: 3pt;
  }
  code {
    background-color: #fce4ec;
    color: #c2185b;
    padding: 1.5pt 4pt;
    border-radius: 3pt;
    font-size: 9pt;
    font-family: Menlo, Monaco, Consolas, monospace;
    font-weight: 600;
  }
  blockquote {
    border-left: 4px solid #e5005c;
    margin: 6pt 0;
    padding: 5pt 10pt;
    background: #fff0f5;
    font-size: 9.5pt;
    color: #444;
  }
  .screenshot-container {
    text-align: center;
    margin: 10pt 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .screenshot-container img {
    max-width: 250px;
    height: auto;
    border-radius: 8pt;
    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    border: 1px solid #e0e0e0;
  }
  .footer-note {
    margin-top: 24pt;
    text-align: center;
    font-size: 8.5pt;
    color: #777;
    border-top: 1px solid #eee;
    padding-top: 10pt;
    page-break-before: avoid;
  }
</style>
</head>
<body>"""]

for line in lines:
    raw = line.strip()
    if raw.startswith('# '):
        html_content.append(f'<h1>{raw[2:]}</h1>')
    elif raw.startswith('## '):
        html_content.append(f'<h2>{raw[3:]}</h2>')
    elif raw.startswith('### '):
        html_content.append(f'<h3>{raw[4:]}</h3>')
    elif raw.startswith('> '):
        html_content.append(f'<blockquote>{raw[2:]}</blockquote>')
    elif raw.startswith('<p align="center">') or raw == '</p>':
        continue
    elif '<img src="screenshots/' in line:
        m = re.search(r'src="([^"]+)"', line)
        if m:
            src = m.group(1)
            abs_src = os.path.abspath(os.path.join('docs', src))
            html_content.append(f'<div class="screenshot-container"><img src="file://{abs_src}" /></div>')
    elif raw.startswith('* ') or raw.startswith('- '):
        item_text = raw[2:]
        item_text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', item_text)
        item_text = re.sub(r'\*([^*]+)\*', r'<em>\1</em>', item_text)
        item_text = re.sub(r'`([^`]+)`', r'<code>\1</code>', item_text)
        html_content.append(f'<li>{item_text}</li>')
    elif re.match(r'^[0-9]+\.\s', raw):
        num_m = re.match(r'^[0-9]+\.\s(.*)$', raw)
        item_text = num_m.group(1) if num_m else raw
        item_text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', item_text)
        item_text = re.sub(r'\*([^*]+)\*', r'<em>\1</em>', item_text)
        item_text = re.sub(r'`([^`]+)`', r'<code>\1</code>', item_text)
        html_content.append(f'<li>{item_text}</li>')
    elif raw == '---':
        html_content.append('<hr style="border:none; border-top:1px solid #ffd1dc; margin: 12pt 0;">')
    elif raw:
        p_text = raw
        p_text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', p_text)
        p_text = re.sub(r'\*([^*]+)\*', r'<em>\1</em>', p_text)
        p_text = re.sub(r'`([^`]+)`', r'<code>\1</code>', p_text)
        html_content.append(f'<p>{p_text}</p>')

html_content.append("""
<div class="footer-note">
  <strong>Daiso Japan Store Operations & Receiving System · Version 7.4</strong><br>
  Inihanda para sa mga Store Clerks at Receiving Associates · Mobile App & PDF Generator ni Kym Rhys Mallari
</div>
</body>
</html>
""")

with open(html_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(html_content))

print(f'HTML written to {html_path}')
