package __PACKAGE__;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.tech.Ndef;
import android.os.Build;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class NfcBridge {
    private final Activity activity;
    private final WebView webView;
    private NfcAdapter nfcAdapter;
    private String mode = "none";
    private String pendingWrite = null;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    public NfcBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        try {
            this.nfcAdapter = NfcAdapter.getDefaultAdapter(activity);
        } catch (Exception e) {
            this.nfcAdapter = null;
        }
    }

    @JavascriptInterface
    public void startNFC() {
        this.mode = "read";
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                enableForegroundDispatch();
            }
        });
    }

    @JavascriptInterface
    public void stopNFC() {
        this.mode = "none";
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                disableForegroundDispatch();
            }
        });
    }

    @JavascriptInterface
    public void writeNFC(String content) {
        this.pendingWrite = content;
        this.mode = "write";
    }

    @JavascriptInterface
    public void cancelWriteNFC() {
        this.mode = "none";
        this.pendingWrite = null;
    }

    public void enableForegroundDispatch() {
        try {
            if (nfcAdapter == null || !nfcAdapter.isEnabled()) return;
            Intent intent = new Intent(activity, activity.getClass())
                    .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
            
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                flags |= PendingIntent.FLAG_MUTABLE;
            }
            
            PendingIntent pi = PendingIntent.getActivity(activity, 0, intent, flags);
            nfcAdapter.enableForegroundDispatch(activity, pi, null, null);
        } catch (Exception ignored) {}
    }

    public void disableForegroundDispatch() {
        try {
            if (nfcAdapter != null) {
                nfcAdapter.disableForegroundDispatch(activity);
            }
        } catch (Exception ignored) {}
    }

    public void handleIntent(final Intent intent) {
        if ("none".equals(mode)) return;
        final Tag tag = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG);
        if (tag == null) return;
        
        executor.execute(new Runnable() {
            @Override
            public void run() {
                if ("read".equals(mode)) {
                    readTag(tag);
                } else if ("write".equals(mode)) {
                    writeTag(tag);
                }
            }
        });
    }

    private void readTag(Tag tag) {
        Ndef ndef = Ndef.get(tag);
        if (ndef == null) return;
        try {
            ndef.connect();
            NdefMessage ndefMessage = ndef.getNdefMessage();
            ndef.close();
            if (ndefMessage == null) return;
            NdefRecord[] records = ndefMessage.getRecords();
            if (records == null || records.length == 0) return;
            
            byte[] payload = records[0].getPayload();
            if (payload == null || payload.length == 0) return;
            
            int langLen = payload[0] & 0x3F;
            final String text = new String(payload, langLen + 1, payload.length - langLen - 1, StandardCharsets.UTF_8);
            
            final String safe = text
                    .replace("\\", "\\\\")
                    .replace("'", "\\'")
                    .replace("\n", "\\n")
                    .replace("\r", "");
            
            webView.post(new Runnable() {
                @Override
                public void run() {
                    webView.evaluateJavascript("window.onNfcRead && window.onNfcRead('" + safe + "');", null);
                }
            });
        } catch (Exception e) {
            try { ndef.close(); } catch (Exception ignored) {}
        }
    }

    private void writeTag(Tag tag) {
        final String content = pendingWrite;
        if (content == null) return;
        final Ndef ndef = Ndef.get(tag);
        if (ndef == null) {
            webView.post(new Runnable() {
                @Override
                public void run() {
                    webView.evaluateJavascript(
                        "window.onNfcWriteResult && window.onNfcWriteResult(false, 'Tag not NDEF formatted. Use a blank writable tag.');", null);
                }
            });
            return;
        }
        try {
            ndef.connect();
            byte[] lang = "en".getBytes(StandardCharsets.US_ASCII);
            byte[] txt = content.getBytes(StandardCharsets.UTF_8);
            byte[] payload = new byte[1 + lang.length + txt.length];
            payload[0] = (byte) lang.length;
            System.arraycopy(lang, 0, payload, 1, lang.length);
            System.arraycopy(txt, 0, payload, 1 + lang.length, txt.length);
            
            NdefRecord record = new NdefRecord(NdefRecord.TNF_WELL_KNOWN, NdefRecord.RTD_TEXT, new byte[0], payload);
            ndef.writeNdefMessage(new NdefMessage(new NdefRecord[]{record}));
            ndef.close();
            
            mode = "none";
            pendingWrite = null;
            
            webView.post(new Runnable() {
                @Override
                public void run() {
                    webView.evaluateJavascript("window.onNfcWriteResult && window.onNfcWriteResult(true, '');", null);
                }
            });
        } catch (Exception e) {
            try { ndef.close(); } catch (Exception ignored) {}
            String message = e.getMessage() != null ? e.getMessage() : "Write failed";
            final String err = message.replace("'", "\\'");
            webView.post(new Runnable() {
                @Override
                public void run() {
                    webView.evaluateJavascript("window.onNfcWriteResult && window.onNfcWriteResult(false, '" + err + "');", null);
                }
            });
        }
    }
}
