package com.sootup.platform.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sootup.platform.model.AnalysisJob;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Component
public class JobStore {

    private static final Logger log = LoggerFactory.getLogger(JobStore.class);
    private final Map<String, AnalysisJob> jobs = new ConcurrentHashMap<>();
    private final ObjectMapper mapper = new ObjectMapper();
    private final File storageFile = new File("jobs.json");

    @PostConstruct
    public void loadJobs() {
        if (storageFile.exists()) {
            try {
                log.info("Loading persisted jobs from jobs.json...");
                List<AnalysisJob> loaded = mapper.readValue(storageFile, new TypeReference<List<AnalysisJob>>() {});
                for (AnalysisJob job : loaded) {
                    jobs.put(job.getJobId(), job);
                }
                log.info("Loaded {} jobs from persistent store.", jobs.size());
            } catch (IOException e) {
                log.error("Failed to read persisted jobs: {}", e.getMessage());
            }
        }
    }

    private synchronized void persist() {
        try {
            mapper.writerWithDefaultPrettyPrinter().writeValue(storageFile, new ArrayList<>(jobs.values()));
        } catch (IOException e) {
            log.error("Failed to persist jobs to jobs.json: {}", e.getMessage());
        }
    }

    public void save(AnalysisJob job) {
        jobs.put(job.getJobId(), job);
        persist();
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
        boolean removed = jobs.remove(jobId) != null;
        if (removed) {
            persist();
        }
        return removed;
    }
}
