package com.nfcaktionen.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/* Verhindert, dass Androids OS-Intent-Dispatch (MainActivity.handleTagIntent)
   während eines aktiven Schreib-/Lese-Vorgangs über @capgo/capacitor-nfc
   dazwischenfunkt und die WebView mit der im Tag hinterlegten Aktion neu lädt. */
@CapacitorPlugin(name = "TagDispatchControl")
public class TagDispatchControlPlugin extends Plugin {
    public static volatile boolean suppressed = false;

    @PluginMethod
    public void suppress(PluginCall call) { suppressed = true; call.resolve(); }

    @PluginMethod
    public void resume(PluginCall call) { suppressed = false; call.resolve(); }
}
