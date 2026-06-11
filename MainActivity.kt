package com.yourname.magiccues

import android.content.Intent
import android.os.Handler
import android.os.Looper
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    private var nfcBridge: NfcBridge? = null

    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        // Defer NFC setup so Capacitor has time to fully initialize
        Handler(Looper.getMainLooper()).post {
            try {
                nfcBridge = NfcBridge(this@MainActivity, bridge.webView)
                bridge.webView.addJavascriptInterface(nfcBridge, "Android")
            } catch (e: Exception) {
                android.util.Log.e("MagicCues", "NFC setup failed: ${e.message}")
            }
        }
    }

    override fun onResume() {
        super.onResume()
        nfcBridge?.enableForegroundDispatch()
    }

    override fun onPause() {
        super.onPause()
        nfcBridge?.disableForegroundDispatch()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        nfcBridge?.handleIntent(intent)
    }
}
