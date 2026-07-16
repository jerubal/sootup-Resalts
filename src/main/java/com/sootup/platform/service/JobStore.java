package com.sootup.platform.service;

import com.sootup.platform.model.AnalysisJob;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Component
public class JobStore {

    private final Map<String, AnalysisJob> jobs = new ConcurrentHashMap<>();

    public void save(AnalysisJob job) {
        jobs.put(job.getJobId(), job);
    }

    public Optional<AnalysisJob> get(String jobId) {
        return Optional.ofNullable(jobs.get(jobId));
    }

    public List<AnalysisJob> list(int page, int size) {
        return jobs.values().stream()
                .sorted(Comparator.comparingLong(AnalysisJob::getCreatedAt).reversed())
                .skip((long) page * size)
                .limit(size)
                .collect(Collectors.toList());
    }

    public int totalJobs() {
        return jobs.size();
    }

    public boolean remove(String jobId) {
        return jobs.remove(jobId) != null;
    }
}
