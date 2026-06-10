package __PACKAGE__

import android.app.Activity
import android.app.PendingIntent
import android.content.Intent
import android.nfc.NdefMessage
import android.nfc.NdefRecord
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.Ndef
import android.os.Build
import android.webkit.JavascriptInterface
import android.webkit.WebView

class NfcBridge(private val activity: Activity, private val webView: WebView) {
    private val nfcAdapter: NfcAdapter? = NfcAdapter.getDefaultAdapter(activity)
    private var mode = "none"
    private var pendingWrite: String? = null

    @JavascriptInterface
    fun startNFC() {
        mode = "read"
        activity.runOnUiThread { enableForegroundDispatch() }
    }

    @JavascriptInterface
    fun stopNFC() {
        mode = "none"
        activity.runOnUiThread { disableForegroundDispatch() }
    }

    @JavascriptInterface
    fun writeNFC(content: String) {
        pendingWrite = content
        mode = "write"
    }

    @JavascriptInterface
    fun cancelWriteNFC() {
        mode = "none"
        pendingWrite = null
    }

    fun enableForegroundDispatch() {
        if (nfcAdapter == null || !nfcAdapter.isEnabled) return
        val intent = Intent(activity, activity.javaClass)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
            PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        else PendingIntent.FLAG_UPDATE_CURRENT
        val pi = PendingIntent.getActivity(activity, 0, intent, flags)
        try { nfcAdapter.enableForegroundDispatch(activity, pi, null, null) }
        catch (ignored: Exception) {}
    }

    fun disableForegroundDispatch() {
        try { nfcAdapter?.disableForegroundDispatch(activity) }
        catch (ignored: Exception) {}
    }

    fun handleIntent(intent: Intent) {
        if (mode == "none") return
        @Suppress("DEPRECATION")
        val tag: Tag = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG) ?: return
        when (mode) {
            "read" -> readTag(tag)
            "write" -> writeTag(tag)
        }
    }

    private fun readTag(tag: Tag) {
        val ndef = Ndef.get(tag) ?: return
        try {
            ndef.connect()
            val payload = ndef.ndefMessage?.records?.firstOrNull()?.payload
                ?: run { ndef.close(); return }
            val langLen = payload[0].toInt() and 0x3F
            val text = String(payload, langLen + 1, payload.size - langLen - 1, Charsets.UTF_8)
            ndef.close()
            val safe = text
                .replace("\\", "\\\\")
                .replace("'", "\\'")
                .replace("\n", "\\n")
                .replace("\r", "")
            webView.post {
                webView.evaluateJavascript(
                    "window.onNfcRead&&window.onNfcRead('$safe');", null)
            }
        } catch (ignored: Exception) {}
    }

    private fun writeTag(tag: Tag) {
        val content = pendingWrite ?: return
        val ndef = Ndef.get(tag) ?: run {
            webView.post { webView.evaluateJavascript(
                "window.onNfcWriteResult&&window.onNfcWriteResult(false,'Tag not NDEF formatted');", null) }
            return
        }
        try {
            ndef.connect()
            val lang = "en".toByteArray(Charsets.US_ASCII)
            val txt = content.toByteArray(Charsets.UTF_8)
            val payload = ByteArray(1 + lang.size + txt.size)
            payload[0] = lang.size.toByte()
            System.arraycopy(lang, 0, payload, 1, lang.size)
            System.arraycopy(txt, 0, payload, 1 + lang.size, txt.size)
            ndef.writeNdefMessage(NdefMessage(arrayOf(
                NdefRecord(NdefRecord.TNF_WELL_KNOWN, NdefRecord.RTD_TEXT, ByteArray(0), payload)
            )))
            ndef.close()
            mode = "none"; pendingWrite = null
            webView.post { webView.evaluateJavascript(
                "window.onNfcWriteResult&&window.onNfcWriteResult(true,'');", null) }
        } catch (e: Exception) {
            val err = (e.message ?: "Write failed").replace("'", "\\'")
            webView.post { webView.evaluateJavascript(
                "window.onNfcWriteResult&&window.onNfcWriteResult(false,'$err');", null) }
        }
    }
}
