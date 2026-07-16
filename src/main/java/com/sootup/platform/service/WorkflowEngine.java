package com.sootup.platform.service;

import com.sootup.platform.model.AnalysisJob;
import sootup.java.core.views.JavaView;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.*;

public class WorkflowEngine {
    private static final Logger log = LoggerFactory.getLogger(WorkflowEngine.class);

    public interface AnalysisStep {
        String getName();
        int getProgressWeight();
        void execute(AnalysisJob job, JavaView[] viewContainer) throws Exception;
    }

    private final List<AnalysisStep> steps = new ArrayList<>();

    public void addStep(AnalysisStep step) {
        steps.add(step);
    }

    public void run(AnalysisJob job, JavaView[] viewContainer) {
        log.info("Starting orchestration workflow for job {}", job.getJobId());
        int currentProgress = 10;
        job.setProgress(currentProgress);

        for (AnalysisStep step : steps) {
            try {
                log.info("Executing Step: {} for job {}", step.getName(), job.getJobId());
                job.setMessage("Running Step: " + step.getName());
                
                step.execute(job, viewContainer);
                
                currentProgress += step.getProgressWeight();
                job.setProgress(Math.min(currentProgress, 95));
            } catch (Exception e) {
                log.error("Step {} failed for job {}: {}", step.getName(), job.getJobId(), e.getMessage(), e);
                throw new RuntimeException("Workflow failed at step '" + step.getName() + "': " + e.getMessage(), e);
            }
        }
    }
}
