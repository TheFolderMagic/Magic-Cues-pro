package __PACKAGE__

import android.content.Intent
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    private lateinit var nfcBridge: NfcBridge

    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        nfcBridge = NfcBridge(this, bridge.webView)
        bridge.webView.addJavascriptInterface(nfcBridge, "Android")
    }

    override fun onResume() {
        super.onResume()
        if (::nfcBridge.isInitialized) nfcBridge.enableForegroundDispatch()
    }

    override fun onPause() {
        super.onPause()
        if (::nfcBridge.isInitialized) nfcBridge.disableForegroundDispatch()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (::nfcBridge.isInitialized) nfcBridge.handleIntent(intent)
    }
}
