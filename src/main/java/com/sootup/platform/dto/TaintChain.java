package com.sootup.platform.dto;

import java.util.List;
import java.util.Map;

/**
 * Represents a single taint chain found during analysis:
 * an ordered path from a taint source to a dangerous sink,
 * proven reachable through the call graph.
 *
 * Returned as a list by GET /api/v1/analyses/{jobId}/taint
 */
public class TaintChain {

    /** Full method signature of the taint source. */
    private String source;

    /** Category of the taint source (e.g. ANDROID_INTENT, NETWORK). */
    private String sourceCategory;

    /** Full method signature of the dangerous sink. */
    private String sink;

    /** Risk category of the sink (e.g. COMMAND_INJECTION, SQL_INJECTION). */
    private String sinkRiskCategory;

    /**
     * Ordered list of method signature IDs from source → sink (inclusive).
     * Each step is an edge in the call graph. Length >= 2.
     */
    private List<String> path;

    /** Number of call hops from source to sink (= path.size() - 1). */
    private int hopCount;

    // FR-M: Business-context risk weighting
    /** Human-readable label from the matching business tag (e.g. "handles payment data"). */
    private String businessTag;

    /** Risk multiplier from the matching business tag (default 1.0 = no boost). */
    private double businessMultiplier = 1.0;

    // TASK 4: Confidence scoring
    /** Confidence of the taint chain finding ("high" | "medium"). */
    private String confidence = "high";

    public TaintChain(String source, String sourceCategory,
                      String sink, String sinkRiskCategory,
                      List<String> path) {
        this.source = source;
        this.sourceCategory = sourceCategory;
        this.sink = sink;
        this.sinkRiskCategory = sinkRiskCategory;
        this.path = path;
        this.hopCount = path.size() - 1;
    }

    public String getSource() { return source; }
    public String getSourceCategory() { return sourceCategory; }
    public String getSink() { return sink; }
    public String getSinkRiskCategory() { return sinkRiskCategory; }
    public List<String> getPath() { return path; }
    public int getHopCount() { return hopCount; }

    // FR-M getters/setters
    public String getBusinessTag() { return businessTag; }
    public void setBusinessTag(String businessTag) { this.businessTag = businessTag; }
    public double getBusinessMultiplier() { return businessMultiplier; }
    public void setBusinessMultiplier(double businessMultiplier) { this.businessMultiplier = businessMultiplier; }

    // TASK 4 getters/setters
    public String getConfidence() { return confidence; }
    public void setConfidence(String confidence) { this.confidence = confidence; }
}
