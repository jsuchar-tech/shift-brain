package com.jakub.grabflex;

import android.content.Context;
import android.content.SharedPreferences;

public final class RideStore {
    private static final String PREFS = "grab_ride";
    private RideStore() {}
    public static void save(Context c, RideState s) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("status", s.status).putString("eta", s.eta)
            .putString("driver", s.driver).putString("car", s.car)
            .putLong("updated", s.updatedAt).apply();
    }
    public static RideState load(Context c) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return new RideState(
            p.getString("status", "Waiting for your Grab booking"),
            p.getString("eta", "Book a car in Grab and it will appear here."),
            p.getString("driver", "Driver details will appear when Grab sends them"),
            p.getString("car", "Tap to open Grab"), p.getLong("updated", 0L));
    }
    public static String raw(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("raw", "No Grab notification captured yet."); }
    public static void saveRaw(Context c, String raw) { c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("raw", raw).apply(); }
}
