package __PACKAGE__;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private NfcBridge nfcBridge = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        try {
            WebView webView = MainActivity.this.getBridge().getWebView();
            if (webView != null) {
                nfcBridge = new NfcBridge(MainActivity.this, webView);
                
                // Inject the NFC bridge immediately so it is available on page load
                webView.addJavascriptInterface(nfcBridge, "Android");
                
                // Extend Capacitor's default WebChromeClient to auto-grant Mic/Web permissions inside the WebView
                webView.setWebChromeClient(new com.getcapacitor.BridgeWebChromeClient(MainActivity.this.getBridge()) {
                    @Override
                    public void onPermissionRequest(final android.webkit.PermissionRequest request) {
                        request.grant(request.getResources());
                    }
                });
            }
        } catch (Exception e) {
            Log.e("MagicCues", "NFC setup failed: " + e.getMessage());
        }
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
