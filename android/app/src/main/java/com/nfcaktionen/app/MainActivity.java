package com.nfcaktionen.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleAppLinkIntent(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleAppLinkIntent(intent);
    }

    // App Links (https://zipcop.github.io/nfc-tag-pwa/...) landen hier als
    // ACTION_VIEW-Intent mit der vollen https-URL. Die Query-Parameter davon
    // an die im WebView laufende index.html weiterreichen - so kann action.js
    // die Aktion genau wie beim direkten Öffnen im Browser verarbeiten, ganz
    // ohne eigene native Parsing-Logik.
    private void handleAppLinkIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) {
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
