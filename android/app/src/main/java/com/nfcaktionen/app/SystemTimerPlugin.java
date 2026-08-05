package com.nfcaktionen.app;

import android.content.Intent;
import android.provider.AlarmClock;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/* Übergibt einen Timer an die auf dem Gerät installierte Uhr-App (z.B.
   Google Clock) statt einen eigenen LocalNotifications-Alarm zu stellen -
   läuft dadurch mit deren eigenem Countdown/Sound/Vibration und ist in den
   Quick Settings sichtbar. Bewusster Trade-off: kein Abbrechen mehr über
   das eigene Dashboard möglich, nur noch über die Uhr-App selbst. */
@CapacitorPlugin(name = "SystemTimer")
public class SystemTimerPlugin extends Plugin {
    @PluginMethod
    public void startTimer(PluginCall call) {
        Integer seconds = call.getInt("seconds");
        String label = call.getString("label", "Timer");

        if (seconds == null || seconds <= 0) {
            call.reject("seconds is required");
            return;
        }

        Intent intent = new Intent(AlarmClock.ACTION_SET_TIMER);
        intent.putExtra(AlarmClock.EXTRA_LENGTH, seconds);
        intent.putExtra(AlarmClock.EXTRA_MESSAGE, label);
        intent.putExtra(AlarmClock.EXTRA_SKIP_UI, true);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            android.util.Log.e("SystemTimerPlugin", "startActivity failed", e);
            call.reject(e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }
}
