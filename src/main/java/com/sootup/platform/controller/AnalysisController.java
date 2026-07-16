package com.sootup.platform.controller;

import com.sootup.platform.dto.AnalysisRequest;
import com.sootup.platform.dto.GraphResponse;
import com.sootup.platform.model.AnalysisJob;
import com.sootup.platform.service.JobStore;
import com.sootup.platform.service.SootUpAnalysisService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/analyses")
public class AnalysisController {

    private final JobStore jobStore;
    private final SootUpAnalysisService analysisService;

    public AnalysisController(JobStore jobStore, SootUpAnalysisService analysisService) {
        this.jobStore = jobStore;
        this.analysisService = analysisService;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> submitAnalysis(@Valid @RequestBody AnalysisRequest request) {
        String jobId = UUID.randomUUID().toString();
        AnalysisJob job = new AnalysisJob(jobId, request);
        jobStore.save(job);

        // Run analysis asynchronously
        analysisService.runAnalysis(job);

        Map<String, Object> response = new HashMap<>();
        response.put("jobId", jobId);
        response.put("status", job.getStatus());
        response.put("message", job.getMessage());

        return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> listJobs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        List<AnalysisJob> jobs = jobStore.list(page, size);
        int total = jobStore.totalJobs();

        Map<String, Object> response = new HashMap<>();
        response.put("jobs", jobs.stream().map(this::toSummaryMap).collect(Collectors.toList()));
        response.put("page", page);
        response.put("size", size);
        response.put("total", total);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{jobId}")
    public ResponseEntity<AnalysisJob> getJobStatus(@PathVariable String jobId) {
        AnalysisJob job = jobStore.get(jobId)
                .orElseThrow(() -> new NoSuchElementException("Job not found: " + jobId));
        return ResponseEntity.ok(job);
    }

    @DeleteMapping("/{jobId}")
    public ResponseEntity<Map<String, Object>> cancelJob(@PathVariable String jobId) {
        AnalysisJob job = jobStore.get(jobId)
                .orElseThrow(() -> new NoSuchElementException("Job not found: " + jobId));

        boolean cancelled = analysisService.cancelJob(jobId);
        if (cancelled) {
            job.setStatus(AnalysisJob.Status.FAILED);
            job.setMessage("Cancelled by user request.");
        }

        // Remove/delete job or just mark failed? The requirement says "cancel a running job and free resources".
        // Let's keep it in store but clean up resources.
        Map<String, Object> response = new HashMap<>();
        response.put("jobId", jobId);
        response.put("cancelled", cancelled);
        response.put("message", "Job cancellation request processed.");

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{jobId}/result")
    public ResponseEntity<Map<String, Object>> getJobResult(@PathVariable String jobId) {
        AnalysisJob job = jobStore.get(jobId)
                .orElseThrow(() -> new NoSuchElementException("Job not found: " + jobId));

        if (job.getStatus() != AnalysisJob.Status.COMPLETED) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Job is not in COMPLETED status", "status", job.getStatus()));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("jobId", jobId);
        response.put("status", job.getStatus());
        response.put("methodCount", job.getMethodCount());
        response.put("edgeCount", job.getEdgeCount());
        response.put("loadedClasses", job.getLoadedClasses());
        response.put("request", job.getRequest());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{jobId}/callgraph")
    public ResponseEntity<GraphResponse> getCallGraph(
            @PathVariable String jobId,
            @RequestParam(required = false) String className,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "200") int size) {

        AnalysisJob job = jobStore.get(jobId)
                .orElseThrow(() -> new NoSuchElementException("Job not found: " + jobId));

        if (job.getStatus() != AnalysisJob.Status.COMPLETED) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }

        GraphResponse cg = job.getCallGraph();
        if (cg == null) {
            return ResponseEntity.ok(new GraphResponse());
        }

        // Apply filters
        List<GraphResponse.Edge> filteredEdges = cg.getEdges();
        if (className != null && !className.isBlank()) {
            filteredEdges = filteredEdges.stream()
                    .filter(e -> {
                        String src = String.valueOf(e.getData().get("source"));
                        String tgt = String.valueOf(e.getData().get("target"));
                        return src.contains(className) || tgt.contains(className);
                    })
                    .collect(Collectors.toList());
        }

        // Paginate edges
        int start = page * size;
        int end = Math.min(start + size, filteredEdges.size());
        List<GraphResponse.Edge> paginatedEdges = Collections.emptyList();
        if (start < filteredEdges.size()) {
            paginatedEdges = filteredEdges.subList(start, end);
        }

        // Collect required nodes for the paginated edges
        Set<String> activeNodeIds = paginatedEdges.stream()
                .flatMap(e -> Arrays.asList(String.valueOf(e.getData().get("source")), String.valueOf(e.getData().get("target"))).stream())
                .collect(Collectors.toSet());

        List<GraphResponse.Node> filteredNodes = cg.getNodes().stream()
                .filter(n -> activeNodeIds.contains(String.valueOf(n.getData().get("id"))))
                .collect(Collectors.toList());

        return ResponseEntity.ok(new GraphResponse(filteredNodes, paginatedEdges));
    }

    @GetMapping("/{jobId}/cfg/{methodSignature}")
    public ResponseEntity<GraphResponse> getMethodCfg(
            @PathVariable String jobId,
            @PathVariable String methodSignature) {

        AnalysisJob job = jobStore.get(jobId)
                .orElseThrow(() -> new NoSuchElementException("Job not found: " + jobId));

        GraphResponse cfg = job.getMethodCfgMap().get(methodSignature);
        if (cfg == null) {
            throw new NoSuchElementException("CFG not found for method signature: " + methodSignature);
        }

        return ResponseEntity.ok(cfg);
    }

    @GetMapping("/{jobId}/jimple/{methodSignature}")
    public ResponseEntity<Map<String, String>> getMethodJimple(
            @PathVariable String jobId,
            @PathVariable String methodSignature) {

        AnalysisJob job = jobStore.get(jobId)
                .orElseThrow(() -> new NoSuchElementException("Job not found: " + jobId));

        String jimple = job.getMethodJimpleMap().get(methodSignature);
        if (jimple == null) {
            throw new NoSuchElementException("Jimple IR not found for method signature: " + methodSignature);
        }

        return ResponseEntity.ok(Map.of("methodSignature", methodSignature, "jimple", jimple));
    }

    @GetMapping("/{jobId}/paths")
    public ResponseEntity<List<String>> getShortestPath(
            @PathVariable String jobId,
            @RequestParam String from,
            @RequestParam String to) {

        AnalysisJob job = jobStore.get(jobId)
                .orElseThrow(() -> new NoSuchElementException("Job not found: " + jobId));

        if (job.getStatus() != AnalysisJob.Status.COMPLETED) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }

        GraphResponse cg = job.getCallGraph();
        if (cg == null) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        Map<String, List<String>> adj = new HashMap<>();
        for (GraphResponse.Edge edge : cg.getEdges()) {
            String src = String.valueOf(edge.getData().get("source"));
            String tgt = String.valueOf(edge.getData().get("target"));
            adj.computeIfAbsent(src, k -> new ArrayList<>()).add(tgt);
        }

        Queue<String> queue = new LinkedList<>();
        Map<String, String> parent = new HashMap<>();
        Set<String> visited = new HashSet<>();

        queue.add(from);
        visited.add(from);

        boolean found = false;
        while (!queue.isEmpty()) {
            String curr = queue.poll();
            if (curr.equals(to)) {
                found = true;
                break;
            }
            List<String> neighbors = adj.getOrDefault(curr, Collections.emptyList());
            for (String neighbor : neighbors) {
                if (visited.add(neighbor)) {
                    parent.put(neighbor, curr);
                    queue.add(neighbor);
                }
            }
        }

        if (!found) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        List<String> path = new ArrayList<>();
        String curr = to;
        while (curr != null) {
            path.add(curr);
            curr = parent.get(curr);
        }
        Collections.reverse(path);

        return ResponseEntity.ok(path);
    }

    @GetMapping("/{jobId}/export")
    public ResponseEntity<Map<String, Object>> exportResults(@PathVariable String jobId) {
        AnalysisJob job = jobStore.get(jobId)
                .orElseThrow(() -> new NoSuchElementException("Job not found: " + jobId));

        if (job.getStatus() != AnalysisJob.Status.COMPLETED) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }

        Map<String, Object> export = new HashMap<>();
        export.put("jobId", jobId);
        export.put("request", job.getRequest());
        export.put("loadedClasses", job.getLoadedClasses());
        export.put("methodCount", job.getMethodCount());
        export.put("edgeCount", job.getEdgeCount());
        export.put("callGraph", job.getCallGraph());
        export.put("jimple", job.getMethodJimpleMap());
        export.put("cfg", job.getMethodCfgMap());

        return ResponseEntity.ok(export);
    }

    private Map<String, Object> toSummaryMap(AnalysisJob job) {
        Map<String, Object> summary = new HashMap<>();
        summary.put("jobId", job.getJobId());
        summary.put("status", job.getStatus());
        summary.put("progress", job.getProgress());
        summary.put("message", job.getMessage());
        summary.put("createdAt", job.getCreatedAt());
        summary.put("completedAt", job.getCompletedAt());
        return summary;
    }
}
