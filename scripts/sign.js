import { execSync } from 'child_process';
import { platform } from 'os';
import { existsSync } from 'fs';

const MAC_BUNDLE_PATH = 'src-tauri/target/release/bundle/macos/Heos Controller.app';
const ENTITLEMENTS_PATH = 'src-tauri/Entitlements.plist';

function signMacOS() {
    if (!existsSync(MAC_BUNDLE_PATH)) {
        console.warn('⚠️  No macOS bundle found at', MAC_BUNDLE_PATH);
        return;
    }

    console.log('🔏 Signing macOS bundle with entitlements...');
    try {
        execSync(`codesign --force --deep --sign - --entitlements ${ENTITLEMENTS_PATH} ${MAC_BUNDLE_PATH}`, { stdio: 'inherit' });
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
