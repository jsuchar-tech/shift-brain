package com.jakub.grabflex;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class GrabNotificationParser {
    private static final Pattern ETA = Pattern.compile("(?i)(?:in|arriv(?:e|ing|es)|eta[: ]*)\\s*(\\d{1,2})\\s*(?:min|mins|minute|minutes)");
    private static final Pattern PLATE = Pattern.compile("\\b[A-Z]{2,4}[- ]?\\d{3,4}\\b");
    private GrabNotificationParser() {}
    public static RideState parse(String title, String text, String bigText, String subText) {
        String joined = clean(join(title, text, bigText, subText));
        String lower = joined.toLowerCase(Locale.ROOT);
        String status = firstNonEmpty(title, text, "Grab ride update");
        String eta = "Open Grab for live trip details";
        String driver = "Your Grab driver";
        String car = "Tap to open Grab";
        Matcher etaMatch = ETA.matcher(joined);
        if (etaMatch.find()) eta = etaMatch.group(1) + " min away";
        Matcher plateMatch = PLATE.matcher(joined);
        if (plateMatch.find()) car = "Plate " + plateMatch.group();
        if (lower.contains("driver is here") || lower.contains("driver has arrived") || lower.contains("arrived")) {
            status = "Your driver is here"; eta = "Head to the pickup point";
        } else if (lower.contains("on the way") || lower.contains("heading to you") || lower.contains("coming to you")) {
            status = "Driver is on the way";
        } else if (lower.contains("finding") || lower.contains("searching") || lower.contains("looking for")) {
            status = "Finding you a driver"; driver = "Matching in progress";
        } else if (lower.contains("trip has started") || lower.contains("ride has started") || lower.contains("on your way")) {
            status = "You're on the way"; eta = "Enjoy your ride";
        } else if (lower.contains("completed") || lower.contains("trip ended") || lower.contains("ride ended")) {
            status = "Ride completed"; eta = "Thanks for riding with Grab";
        } else if (lower.contains("cancelled") || lower.contains("canceled")) {
            status = "Ride cancelled"; eta = "Open Grab to book again";
        }
        if (text != null && text.length() > 3 && !text.equals(status)) driver = text;
        if (bigText != null && bigText.length() > 3 && !bigText.equals(text)) car = bigText;
        return new RideState(trim(status,70), trim(eta,60), trim(driver,80), trim(car,100), System.currentTimeMillis());
    }
    private static String join(String... s) { StringBuilder b = new StringBuilder(); for (String v : s) if (v != null && !v.isBlank()) b.append(v).append(" · "); return b.toString(); }
    private static String clean(String s) { return s.replaceAll("\\s+", " ").trim(); }
    private static String firstNonEmpty(String... s) { for (String v : s) if (v != null && !v.isBlank()) return v; return "Grab ride update"; }
    private static String trim(String s, int max) { return s.length() <= max ? s : s.substring(0,max-1) + "…"; }
}
