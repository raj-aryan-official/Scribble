const fs = require('fs');
const path = require('path');

const sharedTypesJsPath = path.resolve(__dirname, '../shared/types.js');
const sharedTypesCjsPath = path.resolve(__dirname, '../shared/types.cjs');

const jsContent = fs.readFileSync(sharedTypesJsPath, 'utf8');

// Convert ESM exports to CommonJS
let cjsContent = '// Auto-generated from shared/types.js by npm run sync:shared. Do not edit directly.\n\n';
cjsContent += jsContent.replace(/export const /g, 'const ');
cjsContent += '\nmodule.exports = { EVENTS, GAME_STATES };\n';

fs.writeFileSync(sharedTypesCjsPath, cjsContent, 'utf8');
console.log('Successfully synced shared/types.js -> shared/types.cjs');

