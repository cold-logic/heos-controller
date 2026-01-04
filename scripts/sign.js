import { execSync } from 'child_process';
import { platform } from 'os';
import { existsSync } from 'fs';

const UNIVERSAL_BUNDLE_PATH = 'src-tauri/target/universal-apple-darwin/release/bundle/macos/Heos Controller.app';
const RELEASE_BUNDLE_PATH = 'src-tauri/target/release/bundle/macos/Heos Controller.app';
const ENTITLEMENTS_PATH = 'src-tauri/Entitlements.plist';

function signMacOS() {
    // Try universal binary first, then fall back to regular release build
    const bundlePath = existsSync(UNIVERSAL_BUNDLE_PATH) ? UNIVERSAL_BUNDLE_PATH : RELEASE_BUNDLE_PATH;

    if (!existsSync(bundlePath)) {
        console.warn('⚠️  No macOS bundle found. Build the app first with: pnpm run build');
        return;
    }

    console.log(`🔏 Signing macOS bundle: ${bundlePath}`);
    try {
        execSync(`codesign --force --deep --sign - --entitlements ${ENTITLEMENTS_PATH} "${bundlePath}"`, { stdio: 'inherit' });
        console.log('✅ macOS App Bundle Signed Successfully');
    } catch (error) {
        console.error('❌ Failed to sign macOS bundle:', error.message);
        process.exit(1);
    }
}

function main() {
    const currentPlatform = platform();

    console.log(`ℹ️  Post-build signing script running for platform: ${currentPlatform}`);

    if (currentPlatform === 'darwin') {
        signMacOS();
    } else {
        console.log(`ℹ️  Skipping manual signing for ${currentPlatform}. (Only macOS implementation is currently present)`);
    }
}

main();
