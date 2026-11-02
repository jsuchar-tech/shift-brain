package com.jakub.grabflex;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

public class GrabNotificationListener extends NotificationListenerService {
    private static final String GRAB_PACKAGE = "com.grabtaxi.passenger";
    @Override public void onNotificationPosted(StatusBarNotification sbn) {
        if (!GRAB_PACKAGE.equals(sbn.getPackageName())) return;
        Notification n = sbn.getNotification();
        Bundle e = n.extras;
        String title = asString(e.getCharSequence(Notification.EXTRA_TITLE));
        String text = asString(e.getCharSequence(Notification.EXTRA_TEXT));
        String big = asString(e.getCharSequence(Notification.EXTRA_BIG_TEXT));
        String sub = asString(e.getCharSequence(Notification.EXTRA_SUB_TEXT));
        String raw = "title: " + title + "\ntext: " + text + "\nbigText: " + big + "\nsubText: " + sub;
        RideStore.saveRaw(this, raw);
        RideStore.save(this, GrabNotificationParser.parse(title, text, big, sub));
        GrabWidgetProvider.refreshAll(this);
    }
    private static String asString(CharSequence c) { return c == null ? "" : c.toString(); }
}
