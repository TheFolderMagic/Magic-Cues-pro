package __PACKAGE__;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private NfcBridge nfcBridge = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Request native system microphone permission on startup if not already granted
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.RECORD_AUDIO}, 101);
        }
        
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

        // Apply sticky immersive fullscreen configuration on initial start
        setImmersiveMode();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (nfcBridge != null) {
            nfcBridge.enableForegroundDispatch();
        }
        setImmersiveMode();
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

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Automatically hide bars again when user focus returns to the app
        if (hasFocus) {
            setImmersiveMode();
        }
    }

    private void setImmersiveMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                // Hide both the Status Bar and Navigation Bar
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                // Transient behavior: swipes from edges reveal the bars temporarily, then auto-hide them
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            // Backward-compatible fullscreen and navigation layout flags
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
            );
        }
    }
}
