const fs = require('fs');
const content = fs.readFileSync('src/components/OnboardingLandingPage.tsx', 'utf-8');

let tags = [];
const regex = /<\/?([a-zA-Z0-9]+)[^>]*?(\/?)>/g;
let match;
while ((match = regex.exec(content)) !== null) {
    const isClosing = match[0].startsWith('</');
    const isSelfClosing = match[2] === '/';
    const tag = match[1];
    
    if (isSelfClosing || ['input', 'img', 'br', 'hr', 'circle', 'path', 'polyline', 'line', 'rect', 'polygon', 'span'].includes(tag)) {
        if (!isClosing && !isSelfClosing && ['span'].includes(tag)) {
             // wait, span is not self-closing, my array is too naive. I will use standard html-parser.
        }
        // Actually, just let SWC or tsc tell me. 
    }
}
