package com.jakub.grabflex;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.Button;
import android.widget.TextView;

public class MainActivity extends Activity {
    private TextView debug;
    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        debug = findViewById(R.id.debug_text);
        ((Button)findViewById(R.id.notification_access)).setOnClickListener(v -> startActivity(new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")));
        ((Button)findViewById(R.id.open_widget_settings)).setOnClickListener(v -> openFlexSettings());
        ((Button)findViewById(R.id.demo)).setOnClickListener(v -> {
            RideState demo = new RideState("Driver is on the way", "4 min away", "Miguel · 4.9 ★", "Toyota Vios · ABC 1234", System.currentTimeMillis());
            RideStore.save(this, demo);
            RideStore.saveRaw(this, "Demo mode — waiting for a real Grab notification.");
            GrabWidgetProvider.refreshAll(this);
            debug.setText(RideStore.raw(this));
        });
    }
    @Override protected void onResume() { super.onResume(); if (debug != null) debug.setText(RideStore.raw(this)); }
    private void openFlexSettings() {
        Intent i = new Intent(Settings.ACTION_SETTINGS);
        try { i.setClassName("com.android.settings", "com.android.settings.Settings$CoverScreenSettingsActivity"); startActivity(i); }
        catch (Exception e) { startActivity(new Intent(Settings.ACTION_SETTINGS)); }
    }
}
