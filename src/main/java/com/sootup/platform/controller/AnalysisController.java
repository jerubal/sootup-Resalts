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
    public ResponseEntity<?> exportResults(
            @PathVariable String jobId,
            @RequestParam(defaultValue = "json") String format) {
        
        AnalysisJob job = jobStore.get(jobId)
                .orElseThrow(() -> new NoSuchElementException("Job not found: " + jobId));

        if (job.getStatus() != AnalysisJob.Status.COMPLETED) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Conflict", "message", "Analysis job is not completed yet. Status: " + job.getStatus()));
        }

        String rawTarget = job.getRequest().getTargetPath();
        String targetName = rawTarget != null ? new java.io.File(rawTarget).getName() : "analysis";
        String filenameBase = targetName + "_" + jobId.substring(0, 8) + "_results";

        if ("html".equalsIgnoreCase(format)) {
            String html = generateHtmlReport(job, targetName);
            return ResponseEntity.ok()
                    .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filenameBase + ".html\"")
                    .contentType(org.springframework.http.MediaType.TEXT_HTML)
                    .body(html);
        } else if ("zip".equalsIgnoreCase(format)) {
            byte[] zipBytes = generateZipArchive(job, targetName);
            return ResponseEntity.ok()
                    .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filenameBase + ".zip\"")
                    .contentType(org.springframework.http.MediaType.APPLICATION_OCTET_STREAM)
                    .body(zipBytes);
        } else {
            // Default "json"
            Map<String, Object> export = new LinkedHashMap<>();
            export.put("jobId", jobId);
            export.put("request", job.getRequest());
            export.put("loadedClasses", job.getLoadedClasses());
            export.put("methodCount", job.getMethodCount());
            export.put("edgeCount", job.getEdgeCount());
            export.put("callGraph", job.getCallGraph());
            export.put("taintChains", job.getTaintChains());
            export.put("policyViolations", job.getPolicyViolations());
            export.put("externalVulnerabilities", job.getExternalVulnerabilities());
            export.put("jimple", job.getMethodJimpleMap());
            export.put("cfg", job.getMethodCfgMap());

            try {
                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                String prettyJson = mapper.writerWithDefaultPrettyPrinter().writeValueAsString(export);
                return ResponseEntity.ok()
                        .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filenameBase + ".json\"")
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .body(prettyJson);
            } catch (Exception e) {
                return ResponseEntity.internalServerError().body(Map.of("error", "Internal Error", "message", "JSON formatting failed"));
            }
        }
    }

    private String generateHtmlReport(AnalysisJob job, String targetName) {
        StringBuilder sb = new StringBuilder();
        sb.append("<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>SootUp Security Audit Report</title>");
        sb.append("<style>");
        sb.append("body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #060908; color: #e6f5ed; margin: 0; padding: 40px; }");
        sb.append(".report-container { max-width: 1000px; margin: 0 auto; background: #0b0f0d; border: 1px solid #1a241f; border-radius: 12px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }");
        sb.append("h1 { color: #00ff66; margin-top: 0; font-size: 28px; border-bottom: 2px solid #1a241f; padding-bottom: 12px; }");
        sb.append("h2 { color: #e6f5ed; font-size: 20px; margin-top: 32px; border-bottom: 1px solid #1a241f; padding-bottom: 8px; }");
        sb.append("table { width: 100%; border-collapse: collapse; margin: 16px 0; }");
        sb.append("th, td { padding: 12px; border: 1px solid #1a241f; text-align: left; font-size: 13px; }");
        sb.append("th { background: #111714; color: #8da396; }");
        sb.append("pre { background: #111714; padding: 16px; border-radius: 6px; overflow-x: auto; font-family: monospace; font-size: 12px; color: #00ff66; border: 1px solid #1a241f; }");
        sb.append(".badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }");
        sb.append(".badge-red { background: rgba(255, 59, 48, 0.15); color: #ff3b30; }");
        sb.append(".badge-green { background: rgba(0, 255, 102, 0.15); color: #00ff66; }");
        sb.append(".badge-amber { background: rgba(255, 170, 0, 0.15); color: #ffaa00; }");
        sb.append("</style></head><body>");
        sb.append("<div class=\"report-container\">");
        sb.append("<h1>SootUp Security Audit Report</h1>");
        
        // Metadata / Summary
        sb.append("<h2>Target Summary</h2>");
        sb.append("<table>");
        sb.append("<tr><th>Target Archive</th><td>").append(targetName).append("</td></tr>");
        sb.append("<tr><th>Job ID</th><td>").append(job.getJobId()).append("</td></tr>");
        sb.append("<tr><th>Classes Analyzed</th><td>").append(job.getLoadedClasses().size()).append("</td></tr>");
        sb.append("<tr><th>Call Graph Size</th><td>").append(job.getMethodCount()).append(" nodes / ").append(job.getEdgeCount()).append(" edges</td></tr>");
        sb.append("</table>");

        // Policy violations
        sb.append("<h2>Policy Violations</h2>");
        if (job.getPolicyViolations() == null || job.getPolicyViolations().isEmpty()) {
            sb.append("<p style=\"color:#00ff66\">✓ No policy violations identified.</p>");
        } else {
            sb.append("<table><tr><th>Violation</th></tr>");
            for (String violation : job.getPolicyViolations()) {
                sb.append("<tr><td><span class=\"badge badge-red\">VIOLATION</span> <code style=\"color:#ff3b30\">").append(violation).append("</code></td></tr>");
            }
            sb.append("</table>");
        }

        // Taint Findings
        sb.append("<h2>Taint propagation Findings</h2>");
        if (job.getTaintChains() == null || job.getTaintChains().isEmpty()) {
            sb.append("<p style=\"color:#00ff66\">✓ No propagations detected.</p>");
        } else {
            sb.append("<table><tr><th>Source</th><th>Sink</th><th>Hop Count</th></tr>");
            for (com.sootup.platform.dto.TaintChain tc : job.getTaintChains()) {
                sb.append("<tr>");
                sb.append("<td><span class=\"badge badge-amber\">").append(tc.getSourceCategory()).append("</span><br/><code>").append(tc.getSource()).append("</code></td>");
                sb.append("<td><span class=\"badge badge-red\">").append(tc.getSinkRiskCategory()).append("</span><br/><code>").append(tc.getSink()).append("</code></td>");
                sb.append("<td>").append(tc.getHopCount()).append("</td>");
                sb.append("</tr>");
            }
            sb.append("</table>");
        }

        // Call graph snapshot listing
        sb.append("<h2>Call Graph Entries</h2>");
        if (job.getCallGraph() == null || job.getCallGraph().getNodes().isEmpty()) {
            sb.append("<p>No Call Graph data available.</p>");
        } else {
            sb.append("<table><tr><th>Method Signature</th><th>Type</th></tr>");
            for (com.sootup.platform.dto.GraphResponse.Node n : job.getCallGraph().getNodes()) {
                boolean isSink = n.getData().containsKey("riskCategory");
                sb.append("<tr>");
                sb.append("<td><code>").append(n.getData().get("id")).append("</code></td>");
                sb.append("<td>").append(isSink ? "<span class=\"badge badge-red\">SINK</span>" : "<span class=\"badge badge-green\">INTERNAL</span>").append("</td>");
                sb.append("</tr>");
            }
            sb.append("</table>");
        }

        sb.append("</div></body></html>");
        return sb.toString();
    }

    private byte[] generateZipArchive(AnalysisJob job, String targetName) {
        java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
        try (java.util.zip.ZipOutputStream zos = new java.util.zip.ZipOutputStream(baos)) {
            // Write results.json
            zos.putNextEntry(new java.util.zip.ZipEntry("results.json"));
            Map<String, Object> export = new LinkedHashMap<>();
            export.put("jobId", job.getJobId());
            export.put("callGraph", job.getCallGraph());
            export.put("taintChains", job.getTaintChains());
            export.put("policyViolations", job.getPolicyViolations());
            
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            zos.write(mapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(export));
            zos.closeEntry();

            // Write report.html
            zos.putNextEntry(new java.util.zip.ZipEntry("report.html"));
            zos.write(generateHtmlReport(job, targetName).getBytes(java.nio.charset.StandardCharsets.UTF_8));
            zos.closeEntry();

            // Write individual method jimple files
            if (job.getMethodJimpleMap() != null) {
                for (Map.Entry<String, String> entry : job.getMethodJimpleMap().entrySet()) {
                    String cleanName = entry.getKey().replaceAll("[^a-zA-Z0-9_.-]", "_");
                    if (cleanName.length() > 120) {
                        cleanName = cleanName.substring(0, 110) + "_" + Math.abs(cleanName.hashCode()) + ".txt";
                    } else {
                        cleanName = cleanName + ".txt";
                    }
                    zos.putNextEntry(new java.util.zip.ZipEntry("jimple/" + cleanName));
                    zos.write(entry.getValue().getBytes(java.nio.charset.StandardCharsets.UTF_8));
                    zos.closeEntry();
                }
            }
        } catch (Exception e) {
            log.error("Failed to generate zip archive: {}", e.getMessage());
        }
        return baos.toByteArray();
    }


    private Map<String, Object> toSummaryMap(AnalysisJob job) {
        Map<String, Object> summary = new HashMap<>();
        summary.put("jobId",      job.getJobId());
        summary.put("status",     job.getStatus());
        summary.put("progress",   job.getProgress());
        summary.put("message",    job.getMessage());
        summary.put("createdAt",  job.getCreatedAt());
        summary.put("submittedAt",job.getCreatedAt()); // alias for frontend
        summary.put("completedAt",job.getCompletedAt());
        summary.put("methodCount",job.getMethodCount());
        summary.put("edgeCount",  job.getEdgeCount());

        // Request fields used by Dashboard / risk gauge / sidebar
        if (job.getRequest() != null) {
            summary.put("targetPath",    job.getRequest().getTargetPath());
            summary.put("analysisFlags", job.getRequest().getAnalysisFlags());
            summary.put("cgAlgorithm",   job.getRequest().getCgAlgorithm());
        }

        // Taint / policy counts
        summary.put("taintChainsCount",
            job.getTaintChains() != null ? job.getTaintChains().size() : 0);
        summary.put("policyViolationsCount",
            job.getPolicyViolations() != null ? job.getPolicyViolations().size() : 0);

        // Embed taintChains list for risk gauge in frontend
        if (job.getTaintChains() != null && !job.getTaintChains().isEmpty()) {
            summary.put("taintChains", job.getTaintChains());
        }
        if (job.getPolicyViolations() != null && !job.getPolicyViolations().isEmpty()) {
            summary.put("policyViolations", job.getPolicyViolations());
        }

        return summary;
    }
}
