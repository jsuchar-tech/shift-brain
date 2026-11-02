package com.jakub.grabflex;

public class RideState {
    public final String status;
    public final String eta;
    public final String driver;
    public final String car;
    public final long updatedAt;

    public RideState(String status, String eta, String driver, String car, long updatedAt) {
        this.status = status;
        this.eta = eta;
        this.driver = driver;
        this.car = car;
        this.updatedAt = updatedAt;
    }
}
