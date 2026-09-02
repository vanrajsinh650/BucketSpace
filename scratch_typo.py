import re

with open('tailwind.config.js', 'r') as f:
    config = f.read()

config = config.replace("'var(--font-playfair)'", "'var(--font-newsreader)'")
config = config.replace("'Georgia'", "'Times New Roman'")

with open('tailwind.config.js', 'w') as f:
    f.write(config)

with open('src/app/layout.tsx', 'r') as f:
    layout = f.read()

layout = layout.replace("Playfair_Display", "Newsreader")
layout = layout.replace("playfair", "newsreader")
layout = layout.replace("--font-playfair", "--font-newsreader")

with open('src/app/layout.tsx', 'w') as f:
    f.write(layout)
