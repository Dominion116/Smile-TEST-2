// public/js/smileid-loader.js
async function loadSmileIDModule() {
    try {
        console.log('📦 Loading SmileID as ES6 module...');
        
        // Import the module
        const module = await import('/lib/smile-identity/smart-camera-web.js');
        
        console.log('✅ SmileID module loaded successfully');
        return true;
        
    } catch (error) {
        console.error('❌ Failed to load SmileID module:', error);
        return false;
    }
}

// Export for use in main app
window.loadSmileIDModule = loadSmileIDModule;