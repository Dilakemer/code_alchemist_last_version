import re
import requests

html = requests.get('http://127.0.0.1:5000/').text
print('index-C0y2K4yQ.js' in html)
print('index-BG-dRqXR.css' in html)
js = re.search(r'/assets/index-[^"\']+\.js', html)
css = re.search(r'/assets/index-[^"\']+\.css', html)
print(js.group(0) if js else 'no-js')
print(css.group(0) if css else 'no-css')
