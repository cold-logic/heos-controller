import { execSync } from 'child_process';
import { platform } from 'os';
import { existsSync } from 'fs';

const UNIVERSAL_BUNDLE_PATH = 'src-tauri/target/universal-apple-darwin/release/bundle/macos/Heos Controller.app';
const RELEASE_BUNDLE_PATH = 'src-tauri/target/release/bundle/macos/Heos Controller.app';

function openMacOS() {
    // Try universal binary first, then fall back to regular release build
    const bundlePath = existsSync(UNIVERSAL_BUNDLE_PATH) ? UNIVERSAL_BUNDLE_PATH : RELEASE_BUNDLE_PATH;

    if (!existsSync(bundlePath)) {
        console.error('❌ No macOS bundle found. Build the app first with: pnpm run build');
        process.exit(1);
    }

    console.log(`🚀 Opening macOS bundle: ${bundlePath}`);
    try {
        execSync(`open "${bundlePath}"`, { stdio: 'inherit' });
        console.log('✅ App opened successfully');
    } catch (error) {
        console.error('❌ Failed to open macOS bundle:', error.message);
        process.exit(1);
    }
}

function main() {
    const currentPlatform = platform();

    if (currentPlatform === 'darwin') {
        openMacOS();
    } else {
        console.log(`ℹ️  The 'open' command is only available on macOS (current platform: ${currentPlatform})`);
        console.log('ℹ️  On your platform, you can manually run the built executable from the target directory.');
    }
}

main();
