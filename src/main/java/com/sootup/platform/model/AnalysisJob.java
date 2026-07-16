package com.sootup.platform.model;

import com.sootup.platform.dto.AnalysisRequest;
import com.sootup.platform.dto.GraphResponse;
import com.sootup.platform.dto.TaintChain;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class AnalysisJob {

    public enum Status {
        QUEUED, RUNNING, COMPLETED, FAILED, TIMED_OUT
    }

    private String jobId;
    private Status status;
    private AnalysisRequest request;
    private int progress;
    private String message;
    private long createdAt;
    private long completedAt;

    // Results data cached in memory for the job
    private List<String> loadedClasses = new ArrayList<>();
    private Map<String, String> methodJimpleMap = new ConcurrentHashMap<>();
    private Map<String, GraphResponse> methodCfgMap = new ConcurrentHashMap<>();
    private GraphResponse callGraph;
    private int methodCount;
    private int edgeCount;
    // Taint analysis results (populated lazily on first /taint request)
    private List<TaintChain> taintChains = null;

    public AnalysisJob(String jobId, AnalysisRequest request) {
        this.jobId = jobId;
        this.request = request;
        this.status = Status.QUEUED;
        this.progress = 0;
        this.createdAt = System.currentTimeMillis();
        this.message = "Job queued.";
    }

    // Getters and Setters
    public String getJobId() {
        return jobId;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public AnalysisRequest getRequest() {
        return request;
    }

    public int getProgress() {
        return progress;
    }

    public void setProgress(int progress) {
        this.progress = progress;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public long getCreatedAt() {
        return createdAt;
    }

    public long getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(long completedAt) {
        this.completedAt = completedAt;
    }

    public List<String> getLoadedClasses() {
        return loadedClasses;
    }

    public void setLoadedClasses(List<String> loadedClasses) {
        this.loadedClasses = loadedClasses;
    }

    public Map<String, String> getMethodJimpleMap() {
        return methodJimpleMap;
    }

    public Map<String, GraphResponse> getMethodCfgMap() {
        return methodCfgMap;
    }

    public GraphResponse getCallGraph() {
        return callGraph;
    }

    public void setCallGraph(GraphResponse callGraph) {
        this.callGraph = callGraph;
    }

    public int getMethodCount() {
        return methodCount;
    }

    public void setMethodCount(int methodCount) {
        this.methodCount = methodCount;
    }

    public int getEdgeCount() {
        return edgeCount;
    }

    public void setEdgeCount(int edgeCount) {
        this.edgeCount = edgeCount;
    }

    public List<TaintChain> getTaintChains() {
        return taintChains;
    }

    public void setTaintChains(List<TaintChain> taintChains) {
        this.taintChains = taintChains;
    }
}
