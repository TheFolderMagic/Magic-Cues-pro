package __PACKAGE__;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private NfcBridge nfcBridge = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Defer NFC setup so Capacitor has time to fully initialize
        new Handler(Looper.getMainLooper()).post(new Runnable() {
            @Override
            public void run() {
                try {
                    WebView webView = MainActivity.this.getBridge().getWebView();
                    if (webView != null) {
                        nfcBridge = new NfcBridge(MainActivity.this, webView);
                        webView.addJavascriptInterface(nfcBridge, "Android");
                    }
                } catch (Exception e) {
                    Log.e("MagicCues", "NFC setup failed: " + e.getMessage());
                }
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        if (nfcBridge != null) {
            nfcBridge.enableForegroundDispatch();
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        if (nfcBridge != null) {
            nfcBridge.disableForegroundDispatch();
        }
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (nfcBridge != null) {
            nfcBridge.handleIntent(intent);
        }
    }
}
