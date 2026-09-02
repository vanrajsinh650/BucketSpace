import re
with open('src/components/OnboardingLandingPage.tsx', 'r') as f:
    text = f.read()

# 1. Update image
text = text.replace("https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=2000&auto=format&fit=crop", "/images/dark_ethereal_cloud.jpg")

# 2. Typography classes
text = text.replace("font-serif", "font-serif") # we already changed playfair to newsreader in layout and tailwind config

# 3. Claims & Strings
text = text.replace("Your files. Your space.", "Client-side encrypted. Telegram-backed.")
text = text.replace("Store, organize, search and share your files from one private space. Built for privacy. Built for you.", "A personal cloud storage layer built on Telegram MTProto. Encrypted on your device before upload.")
text = text.replace("Private by default", "Client-Side Encryption")
text = text.replace("Your data belongs to you and only you.", "AES-256-GCM encryption before upload.")
text = text.replace("Smart search", "Local File Indexing")
text = text.replace("Find anything instantly with powerful search across all your spaces.", "Search your files instantly using the client-side IndexedDB index.")
text = text.replace("Organize easily", "Virtual File System")
text = text.replace("Use folders, collections and tags your way to keep things tidy.", "Organize your files in a local virtual directory structure.")
text = text.replace("Share securely", "Export Configurations")
text = text.replace("Share files and folders with anyone you choose, with strict access controls.", "Export a shareable configuration token for others to download files.")
text = text.replace("We don't sell your data. We don't scan your files. You're always in control of your digital life.", "Open-source client architecture. Keys never leave your browser.")

# 4. Storage & Fake Data
text = text.replace('<span className="text-white">1.24 TB</span> of 2 TB used', '<span className="text-white">Demo</span> Storage')
text = text.replace('<div className="h-full bg-white w-[62%] rounded-full"></div>', '<div className="h-full bg-white w-[0%] rounded-full"></div>')

# Remove fake file dates/sizes, change them to illustrative examples
text = text.replace("1.2 GB", "Demo File")
text = text.replace("8.4 GB", "Demo File")
text = text.replace("2.1 GB", "Demo File")
text = text.replace("24.5 MB", "Demo File")
text = text.replace("12.1 MB", "Demo File")
text = text.replace("3.6 MB", "Demo File")

text = text.replace("Today, 9:41 AM", "Example")
text = text.replace("Yesterday, 3:22 PM", "Example")
text = text.replace("May 10, 2024", "Example")
text = text.replace("May 8, 2024", "Example")
text = text.replace("May 6, 2024", "Example")
text = text.replace("May 3, 2024", "Example")

# 5. Nav Links (Remove Dead Links)
nav_links_to_remove = [
    '<a href="#security" className="hover:text-stone-50 transition-colors">Security</a>',
    '<a href="#pricing" className="hover:text-stone-50 transition-colors">Pricing</a>',
    '<a href="#" className="text-stone-500 hover:text-stone-300">Security</a>',
    '<a href="#" className="text-stone-500 hover:text-stone-300">Pricing</a>',
    '<a href="#" className="text-stone-500 hover:text-stone-300">Privacy</a>',
    '<a href="#" className="text-stone-500 hover:text-stone-300">Terms</a>'
]
for link in nav_links_to_remove:
    text = text.replace(link, '')

text = text.replace('href="#"', 'href="https://github.com/vanrajsinh650/BucketSpace"')

# Add motion-safe: to animations
text = text.replace('animate-float-delayed', 'motion-safe:animate-float-delayed')
text = text.replace('animate-float', 'motion-safe:animate-float')
text = text.replace('animate-pulse-slow', 'motion-safe:animate-pulse-slow')

with open('src/components/OnboardingLandingPage.tsx', 'w') as f:
    f.write(text)
