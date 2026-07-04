import { execSync } from 'child_process';
import { platform } from 'os';

function buildTauri() {
    const currentPlatform = platform();

    console.log(`ℹ️  Building Tauri application for platform: ${currentPlatform}`);

    let buildCommand;
    const buildEnv = { ...process.env };

    if (currentPlatform === 'darwin') {
        console.log('🍎 Building universal binary for macOS (Intel + Apple Silicon)');
        buildCommand = 'tauri build --target universal-apple-darwin';
    } else {
        console.log(`🔨 Building for ${currentPlatform}`);
        buildCommand = 'tauri build';
    }

    // On Linux, linuxdeploy's bundled `strip` (old binutils) can't parse the
    // `.relr.dyn` (RELR) relocation sections in modern system libraries, which
    // aborts AppImage bundling. NO_STRIP tells linuxdeploy to skip stripping.
    if (currentPlatform === 'linux') {
        buildEnv.NO_STRIP = 'true';
    }

    try {
        execSync(buildCommand, { stdio: 'inherit', env: buildEnv });
        console.log('✅ Build completed successfully');
    } catch (error) {
        console.error('❌ Build failed:', error.message);
        process.exit(1);
    }
}

buildTauri();
