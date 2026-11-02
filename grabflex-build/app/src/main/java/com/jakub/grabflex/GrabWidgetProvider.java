package com.jakub.grabflex;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class GrabWidgetProvider extends AppWidgetProvider {
    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) update(context, manager, id);
    }
    static void refreshAll(Context context) {
        AppWidgetManager m = AppWidgetManager.getInstance(context);
        int[] ids = m.getAppWidgetIds(new ComponentName(context, GrabWidgetProvider.class));
        for (int id : ids) update(context, m, id);
    }
    private static void update(Context context, AppWidgetManager manager, int widgetId) {
        RideState ride = RideStore.load(context);
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_grab);
        v.setTextViewText(R.id.status, ride.status);
        v.setTextViewText(R.id.eta, ride.eta);
        v.setTextViewText(R.id.driver, ride.driver);
        v.setTextViewText(R.id.car, ride.car);
        v.setTextViewText(R.id.state_pill, ride.updatedAt == 0 ? "READY" : "LIVE");
        String updated = ride.updatedAt == 0 ? "Grant notification access in Grab Flex" : "Updated " + new SimpleDateFormat("h:mm a", Locale.getDefault()).format(new Date(ride.updatedAt));
        v.setTextViewText(R.id.updated, updated);
        PackageManager pm = context.getPackageManager();
        Intent launch = pm.getLaunchIntentForPackage("com.grabtaxi.passenger");
        if (launch == null) launch = new Intent(context, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(context, 8, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.widget_root, pi);
        manager.updateAppWidget(widgetId, v);
    }
}
