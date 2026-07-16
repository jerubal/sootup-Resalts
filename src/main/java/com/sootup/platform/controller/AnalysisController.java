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

    @GetMapping("/{jobId}/taint")
    public ResponseEntity<List<com.sootup.platform.dto.TaintChain>> getTaintChains(@PathVariable String jobId) {
        AnalysisJob job = jobStore.get(jobId)
                .orElseThrow(() -> new NoSuchElementException("Job not found: " + jobId));

        if (job.getStatus() != AnalysisJob.Status.COMPLETED) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }

        // Lazy computation and caching of taint chains
        if (job.getTaintChains() == null) {
            List<com.sootup.platform.dto.TaintChain> chains = analysisService.computeTaintChains(job);
            job.setTaintChains(chains);
        }

        return ResponseEntity.ok(job.getTaintChains());
    }


    @GetMapping("/diff")
    public ResponseEntity<Map<String, Object>> diffAnalyses(
            @RequestParam String jobId1,
            @RequestParam String jobId2) {

        AnalysisJob job1 = jobStore.get(jobId1)
                .orElseThrow(() -> new NoSuchElementException("Job not found: " + jobId1));
        AnalysisJob job2 = jobStore.get(jobId2)
                .orElseThrow(() -> new NoSuchElementException("Job not found: " + jobId2));

        if (job1.getStatus() != AnalysisJob.Status.COMPLETED || job2.getStatus() != AnalysisJob.Status.COMPLETED) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Both jobs must be COMPLETED to perform a diff"));
        }

        // Diff classes
        Set<String> classes1 = new HashSet<>(job1.getLoadedClasses());
        Set<String> classes2 = new HashSet<>(job2.getLoadedClasses());

        Set<String> addedClasses = new HashSet<>(classes2);
        addedClasses.removeAll(classes1);

        Set<String> removedClasses = new HashSet<>(classes1);
        removedClasses.removeAll(classes2);

        // Diff methods
        Set<String> methods1 = job1.getMethodJimpleMap().keySet();
        Set<String> methods2 = job2.getMethodJimpleMap().keySet();

        Set<String> addedMethods = new HashSet<>(methods2);
        addedMethods.removeAll(methods1);

        Set<String> removedMethods = new HashSet<>(methods1);
        removedMethods.removeAll(methods2);

        // Diff taint chains
        if (job1.getTaintChains() == null) {
            job1.setTaintChains(analysisService.computeTaintChains(job1));
        }
        if (job2.getTaintChains() == null) {
            job2.setTaintChains(analysisService.computeTaintChains(job2));
        }

        Set<String> taintSinks1 = job1.getTaintChains().stream().map(c -> c.getSink()).collect(Collectors.toSet());
        Set<String> taintSinks2 = job2.getTaintChains().stream().map(c -> c.getSink()).collect(Collectors.toSet());

        Set<String> newTaintSinks = new HashSet<>(taintSinks2);
        newTaintSinks.removeAll(taintSinks1);

        Set<String> resolvedTaintSinks = new HashSet<>(taintSinks1);
        resolvedTaintSinks.removeAll(taintSinks2);

        Map<String, Object> diff = new HashMap<>();
        diff.put("jobId1", jobId1);
        diff.put("jobId2", jobId2);
        diff.put("addedClasses", addedClasses);
        diff.put("removedClasses", removedClasses);
        diff.put("addedMethods", addedMethods);
        diff.put("removedMethods", removedMethods);
        diff.put("newTaintSinks", newTaintSinks);
        diff.put("resolvedTaintSinks", resolvedTaintSinks);

        return ResponseEntity.ok(diff);
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
