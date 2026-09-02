const fs = require('fs');
const content = fs.readFileSync('src/components/OnboardingLandingPage.tsx', 'utf-8');

let brace = 0;
let paren = 0;
for (let i=0; i<content.length; i++) {
  if (content[i] === '{') brace++;
  if (content[i] === '}') brace--;
  if (content[i] === '(') paren++;
  if (content[i] === ')') paren--;
}
console.log('Braces:', brace, 'Parens:', paren);
