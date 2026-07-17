package com.sootup.platform.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Set;

public class AnalysisRequest {

    @NotBlank(message = "targetPath must not be blank")
    private String targetPath;

    @NotEmpty(message = "entryPoints must contain at least one entry method or class signature")
    private List<String> entryPoints;

    private int bytecodeVersion = 17; // default

    private Set<String> analysisFlags = Set.of("callGraph", "cfg", "jimple");

    @NotNull(message = "cgAlgorithm must not be null")
    private String cgAlgorithm = "CHA"; // CHA, RTA, or QILIN

    // Getters and Setters
    public String getTargetPath() {
        return targetPath;
    }

    public void setTargetPath(String targetPath) {
        this.targetPath = targetPath;
    }

    public List<String> getEntryPoints() {
        return entryPoints;
    }

    public void setEntryPoints(List<String> entryPoints) {
        this.entryPoints = entryPoints;
    }

    public int getBytecodeVersion() {
        return bytecodeVersion;
    }

    public void setBytecodeVersion(int bytecodeVersion) {
        this.bytecodeVersion = bytecodeVersion;
    }

    public Set<String> getAnalysisFlags() {
        return analysisFlags;
    }

    public void setAnalysisFlags(Set<String> analysisFlags) {
        this.analysisFlags = analysisFlags;
    }

    public String getCgAlgorithm() {
        return cgAlgorithm;
    }

    public void setCgAlgorithm(String cgAlgorithm) {
        this.cgAlgorithm = cgAlgorithm;
    }
}
