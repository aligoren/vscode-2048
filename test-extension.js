// Hızlı test scripti
const fs = require('fs');

console.log('🔍 Extension Test Kontrolü\n');

// 1. Compiled files kontrolü
const requiredFiles = [
    'out/extension.js',
    'out/gameViewProvider.js',
    'out/gameController.js'
];

console.log('📁 Compiled Files:');
requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file}`);
    } else {
        console.log(`❌ ${file} - MISSING!`);
    }
});

// 2. Package.json kontrolü
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
console.log('\n📦 Package.json Configuration:');
console.log(`✅ Main: ${packageJson.main}`);
console.log(`✅ Views Container: ${packageJson.contributes.viewsContainers ? 'OK' : 'MISSING'}`);
console.log(`✅ Views: ${packageJson.contributes.views ? 'OK' : 'MISSING'}`);

// 3. Extension.js içeriği kontrolü
if (fs.existsSync('out/extension.js')) {
    const extensionContent = fs.readFileSync('out/extension.js', 'utf8');
    console.log('\n🔧 Extension.js Analysis:');
    console.log(`✅ registerWebviewViewProvider: ${extensionContent.includes('registerWebviewViewProvider') ? 'OK' : 'MISSING'}`);
    console.log(`✅ GameViewProvider: ${extensionContent.includes('GameViewProvider') ? 'OK' : 'MISSING'}`);
    console.log(`✅ 2048Game viewType: ${extensionContent.includes('2048Game') ? 'OK' : 'MISSING'}`);
}

console.log('\n🚀 Şimdi F5 ile debug modunu başlatın!');