import { execSync } from 'child_process';
import { platform } from 'os';

function buildTauri() {
    const currentPlatform = platform();

    console.log(`ℹ️  Building Tauri application for platform: ${currentPlatform}`);

    let buildCommand;

    if (currentPlatform === 'darwin') {
        console.log('🍎 Building universal binary for macOS (Intel + Apple Silicon)');
        buildCommand = 'tauri build --target universal-apple-darwin';
    } else {
        console.log(`🔨 Building for ${currentPlatform}`);
        buildCommand = 'tauri build';
    }

    try {
        execSync(buildCommand, { stdio: 'inherit' });
        console.log('✅ Build completed successfully');
    } catch (error) {
        console.error('❌ Build failed:', error.message);
        process.exit(1);
    }
}

buildTauri();
