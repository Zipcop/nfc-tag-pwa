package com.nfcaktionen.app;

import android.content.Intent;
import android.net.Uri;
import android.nfc.NfcAdapter;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SystemTimerPlugin.class);
        super.onCreate(savedInstanceState);
        handleTagIntent(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleTagIntent(intent);
    }

    // Tags mit dem eigenen "nfcaktionen://"-Schema (siehe AndroidManifest.xml
    // und app.js: buildTagUrl()) landen hier als ACTION_VIEW-Intent. Die
    // Query-Parameter davon an die im WebView laufende index.html
    // weiterreichen - so verarbeitet action.js das genau wie beim direkten
    // Öffnen im Browser, ganz ohne eigene native Parsing-Logik.
    private void handleTagIntent(Intent intent) {
        if (intent == null) {
            return;
        }
        String action = intent.getAction();
        boolean isTagIntent = Intent.ACTION_VIEW.equals(action) || NfcAdapter.ACTION_NDEF_DISCOVERED.equals(action);
        if (!isTagIntent) {
            return;
        }
        Uri data = intent.getData();
        if (data == null || getBridge() == null || getBridge().getWebView() == null) {
            return;
        }
        String query = data.getEncodedQuery();
        String target = "https://localhost/index.html" + (query != null ? "?" + query : "");
        getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(target));
    }
}
