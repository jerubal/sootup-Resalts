package com.sootup.platform.controller;

import com.sootup.platform.model.AnalysisJob;
import com.sootup.platform.service.JobStore;
import com.sootup.platform.service.SootUpAnalysisService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Admin/God-Mode endpoints:
 *  POST /api/v1/analyses/{jobId}/query       — GM-1 REPL query console
 *  PUT  /api/v1/admin/sink-catalog           — GM-2 live rule editor
 *  GET  /api/v1/admin/search?q=              — GM-4 cross-job search
 *  GET  /api/v1/content/owasp-top10         — UI-10 OWASP data
 *  GET  /api/v1/admin/system                 — GM-6 system console metrics
 *  POST /api/v1/analyses/{jobId}/webhooks    — GM-5 webhook registration
 *  POST /api/v1/bookmarks                    — GM-8 snapshot bookmarks
 *  GET  /api/v1/bookmarks/{id}              — GM-8 retrieve bookmark
 */
@RestController
@RequestMapping("/api/v1")
@CrossOrigin(origins = "*")
public class AdminController {

    @Autowired private JobStore jobStore;
    @Autowired private SootUpAnalysisService analysisService;

    // ── Persisted state ──────────────────────────────────────────────────────
    private final Map<String, List<Map<String, Object>>> webhooks = new java.util.concurrent.ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> bookmarks = new java.util.concurrent.ConcurrentHashMap<>();

    // ══════════════════════════════════════════════════════════════════════════
    // GM-1: Query Console — POST /api/v1/analyses/{jobId}/query
    // ══════════════════════════════════════════════════════════════════════════
    @PostMapping("/analyses/{jobId}/query")
    public ResponseEntity<?> query(@PathVariable String jobId, @RequestBody Map<String, String> body) {
        Optional<AnalysisJob> opt = jobStore.get(jobId);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        AnalysisJob job = opt.get();
        String q = body.getOrDefault("query", "").trim();
        if (q.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "Empty query"));

        List<Map<String, Object>> results = executeQuery(job, q);
        return ResponseEntity.ok(Map.of("query", q, "results", results, "count", results.size()));
    }

    private List<Map<String, Object>> executeQuery(AnalysisJob job, String q) {
        String lower = q.toLowerCase();
        List<Map<String, Object>> out = new ArrayList<>();

        // sinks [where category = "X"]
        if (lower.startsWith("sinks")) {
            List<Map<String, Object>> nodes = job.getCallGraph() != null
                ? job.getCallGraph().getNodes().stream()
                    .filter(n -> n.getData().containsKey("riskCategory"))
                    .map(n -> n.getData())
                    .collect(Collectors.toList())
                : List.of();
            if (lower.contains("where category")) {
                java.util.regex.Matcher m = java.util.regex.Pattern
                    .compile("category\\s*=\\s*[\"']([^\"']+)[\"']", java.util.regex.Pattern.CASE_INSENSITIVE)
                    .matcher(q);
                if (m.find()) {
                    String cat = m.group(1).toUpperCase();
                    nodes = nodes.stream()
                        .filter(n -> cat.equals(String.valueOf(n.get("riskCategory"))))
                        .collect(Collectors.toList());
                }
            }
            return nodes;
        }

        // sources
        if (lower.startsWith("sources")) {
            return job.getCallGraph() != null
                ? job.getCallGraph().getNodes().stream()
                    .filter(n -> n.getData().containsKey("sourceCategory"))
                    .map(n -> n.getData())
                    .collect(Collectors.toList())
                : List.of();
        }

        // classes
        if (lower.startsWith("classes")) {
            return job.getLoadedClasses().stream()
                .map(c -> Map.<String, Object>of("class", c))
                .collect(Collectors.toList());
        }

        // taint chains
        if (lower.startsWith("taint") || lower.startsWith("chains")) {
            if (job.getTaintChains() == null) return List.of(Map.of("info", "No taint chains computed yet"));
            return job.getTaintChains().stream().map(tc -> {
                Map<String, Object> m2 = new LinkedHashMap<>();
                m2.put("source", tc.getSource());
                m2.put("sourceCategory", tc.getSourceCategory());
                m2.put("sink", tc.getSink());
                m2.put("sinkRiskCategory", tc.getSinkRiskCategory());
                m2.put("hopCount", tc.getHopCount());
                return m2;
            }).collect(Collectors.toList());
        }

        // policy violations
        if (lower.startsWith("policy") || lower.startsWith("violations")) {
            return job.getPolicyViolations().stream()
                .map(v -> Map.<String, Object>of("violation", v))
                .collect(Collectors.toList());
        }

        // callers of <pattern> [depth<=N]
        if (lower.startsWith("callers of")) {
            String pattern = q.substring("callers of".length()).trim()
                .replaceAll("\\s+depth<=\\d+", "").trim();
            if (job.getCallGraph() == null) return List.of();
            // Build reverse adjacency
            Map<String, List<String>> revAdj = new HashMap<>();
            job.getCallGraph().getEdges().forEach(e -> {
                String src = String.valueOf(e.getData().get("source"));
                String tgt = String.valueOf(e.getData().get("target"));
                revAdj.computeIfAbsent(tgt, k -> new ArrayList<>()).add(src);
            });
            final String pat = pattern;
            return job.getCallGraph().getNodes().stream()
                .filter(n -> String.valueOf(n.getData().get("id")).toLowerCase().contains(pat.toLowerCase()))
                .flatMap(n -> {
                    String id = String.valueOf(n.getData().get("id"));
                    List<String> callers = revAdj.getOrDefault(id, List.of());
                    return callers.stream().map(c -> Map.<String, Object>of("callee", id, "caller", c));
                })
                .collect(Collectors.toList());
        }

        // help
        out.add(Map.of("info", "Available commands: sinks | sinks where category=\"X\" | sources | classes | taint | callers of <pattern> | policy | help"));
        return out;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // GM-2: Live Sink Catalog — PUT /api/v1/admin/sink-catalog
    // ══════════════════════════════════════════════════════════════════════════
    @PutMapping("/admin/sink-catalog")
    public ResponseEntity<?> updateSinkCatalog(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<Map<String, String>> rules = (List<Map<String, String>>) body.getOrDefault("rules", List.of());
        // Hot-swap catalog in analysis service
        analysisService.getSinkCatalog().clear();
        for (Map<String, String> rule : rules) {
            String pattern = rule.get("pattern");
            String category = rule.get("riskCategory");
            if (pattern != null && category != null) {
                analysisService.getSinkCatalog().put(pattern, category);
            }
        }
        return ResponseEntity.ok(Map.of(
            "status", "reloaded",
            "rulesLoaded", analysisService.getSinkCatalog().size()
        ));
    }

    @GetMapping("/admin/sink-catalog")
    public ResponseEntity<?> getSinkCatalog() {
        List<Map<String, String>> rules = analysisService.getSinkCatalog().entrySet().stream()
            .map(e -> Map.of("pattern", e.getKey(), "riskCategory", e.getValue()))
            .collect(Collectors.toList());
        return ResponseEntity.ok(Map.of("rules", rules, "count", rules.size()));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // GM-4: Cross-Job Global Search — GET /api/v1/admin/search?q=
    // ══════════════════════════════════════════════════════════════════════════
    @GetMapping("/admin/search")
    public ResponseEntity<?> crossJobSearch(@RequestParam String q) {
        if (q == null || q.isBlank()) return ResponseEntity.badRequest().body(Map.of("error", "Query is required"));
        String lq = q.toLowerCase();
        List<Map<String, Object>> matches = new ArrayList<>();
        for (AnalysisJob job : jobStore.list(0, 1000)) {
            boolean matchedJob = job.getRequest().getTargetPath().toLowerCase().contains(lq);
            // Search loaded classes
            long classMatches = job.getLoadedClasses().stream()
                .filter(c -> c.toLowerCase().contains(lq)).count();
            // Search taint chains
            long taintMatches = job.getTaintChains() != null ? job.getTaintChains().stream()
                .filter(tc -> tc.getSource().toLowerCase().contains(lq) || tc.getSink().toLowerCase().contains(lq))
                .count() : 0;
            // Search call graph nodes
            long nodeMatches = job.getCallGraph() != null ? job.getCallGraph().getNodes().stream()
                .filter(n -> String.valueOf(n.getData().get("id")).toLowerCase().contains(lq))
                .count() : 0;

            if (matchedJob || classMatches > 0 || taintMatches > 0 || nodeMatches > 0) {
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("jobId", job.getJobId());
                result.put("target", job.getRequest().getTargetPath());
                result.put("status", job.getStatus());
                result.put("matchedClasses", classMatches);
                result.put("matchedNodes", nodeMatches);
                result.put("matchedTaintChains", taintMatches);
                matches.add(result);
            }
        }
        return ResponseEntity.ok(Map.of("query", q, "results", matches, "total", matches.size()));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // UI-10: OWASP Top 10 (Option A — versioned static data) GET /api/v1/content/owasp-top10
    // ══════════════════════════════════════════════════════════════════════════
    @GetMapping("/content/owasp-top10")
    public ResponseEntity<?> owaspTop10() {
        List<Map<String, Object>> top10 = List.of(
            Map.of("rank",1,"id","A01:2025","name","Broken Access Control","description","Access control enforces policy such that users cannot act outside of their intended permissions. Failures lead to unauthorized access, data disclosure, modification, or destruction.","owaspUrl","https://owasp.org/Top10/A01_2021-Broken_Access_Control/","relatedSinkCategories",List.of("REFLECTION","FILE")),
            Map.of("rank",2,"id","A02:2025","name","Cryptographic Failures","description","Failures related to cryptography often lead to sensitive data exposure. This includes use of weak algorithms, improper key management, or transmitting data in cleartext.","owaspUrl","https://owasp.org/Top10/A02_2021-Cryptographic_Failures/","relatedSinkCategories",List.of("NETWORK")),
            Map.of("rank",3,"id","A03:2025","name","Injection","description","Injection flaws — SQL, NoSQL, OS, LDAP — occur when untrusted data is sent to an interpreter as part of a command or query. Attacker-supplied data can trick the interpreter into executing unintended commands.","owaspUrl","https://owasp.org/Top10/A03_2021-Injection/","relatedSinkCategories",List.of("SQL_INJECTION","COMMAND_INJECTION","LDAP_INJECTION","XPATH_INJECTION")),
            Map.of("rank",4,"id","A04:2025","name","Insecure Design","description","Insecure design is a broad category representing different weaknesses, expressed as missing or ineffective control design. Missing threat modeling, insecure design patterns, and reference architectures.","owaspUrl","https://owasp.org/Top10/A04_2021-Insecure_Design/","relatedSinkCategories",List.of()),
            Map.of("rank",5,"id","A05:2025","name","Security Misconfiguration","description","The application might be vulnerable if it is missing appropriate security hardening, or has insecure default values, incomplete or ad hoc configurations, or verbose error messages.","owaspUrl","https://owasp.org/Top10/A05_2021-Security_Misconfiguration/","relatedSinkCategories",List.of()),
            Map.of("rank",6,"id","A06:2025","name","Vulnerable and Outdated Components","description","Components (libraries, frameworks) run with the same privileges as the application. If a vulnerable component is exploited, such an attack can facilitate serious data loss or server takeover.","owaspUrl","https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/","relatedSinkCategories",List.of()),
            Map.of("rank",7,"id","A07:2025","name","Identification and Authentication Failures","description","Confirmation of the user's identity, authentication, and session management is critical to protect against authentication-related attacks.","owaspUrl","https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/","relatedSinkCategories",List.of()),
            Map.of("rank",8,"id","A08:2025","name","Software and Data Integrity Failures","description","Software and data integrity failures relate to code and infrastructure that does not protect against integrity violations. Insecure deserialization is a common manifestation.","owaspUrl","https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/","relatedSinkCategories",List.of("INSECURE_DESERIALIZATION")),
            Map.of("rank",9,"id","A09:2025","name","Security Logging and Monitoring Failures","description","Without logging and monitoring, breaches cannot be detected. Insufficient logging, detection, monitoring, and active response occurs at every stage of an operation.","owaspUrl","https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/","relatedSinkCategories",List.of()),
            Map.of("rank",10,"id","A10:2025","name","Server-Side Request Forgery (SSRF)","description","SSRF flaws occur whenever a web application fetches a remote resource without validating the user-supplied URL. It allows an attacker to coerce the application to send a crafted request to an unexpected destination.","owaspUrl","https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/","relatedSinkCategories",List.of("NETWORK","SSRF"))
        );
        return ResponseEntity.ok(Map.of(
            "edition", "OWASP Top 10 — 2025",
            "lastUpdated", "2025-01-01",
            "source", "https://owasp.org/www-project-top-ten/",
            "items", top10
        ));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // GM-5: Webhook registration — POST /api/v1/analyses/{jobId}/webhooks
    // ══════════════════════════════════════════════════════════════════════════
    @PostMapping("/analyses/{jobId}/webhooks")
    public ResponseEntity<?> registerWebhook(@PathVariable String jobId, @RequestBody Map<String, Object> body) {
        webhooks.computeIfAbsent(jobId, k -> new ArrayList<>()).add(body);
        return ResponseEntity.ok(Map.of("status", "registered", "jobId", jobId, "webhookUrl", body.get("url")));
    }

    @GetMapping("/analyses/{jobId}/webhooks")
    public ResponseEntity<?> listWebhooks(@PathVariable String jobId) {
        return ResponseEntity.ok(webhooks.getOrDefault(jobId, List.of()));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // GM-6: System Console — GET /api/v1/admin/system
    // ══════════════════════════════════════════════════════════════════════════
    @GetMapping("/admin/system")
    public ResponseEntity<?> systemConsole() {
        Runtime rt = Runtime.getRuntime();
        long totalMem = rt.totalMemory();
        long freeMem = rt.freeMemory();
        long usedMem = totalMem - freeMem;
        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("totalJobsEver", jobStore.totalJobs());
        metrics.put("runningJobs", jobStore.list(0, 1000).stream().filter(j -> j.getStatus() == com.sootup.platform.model.AnalysisJob.Status.RUNNING).count());
        metrics.put("queuedJobs", jobStore.list(0, 1000).stream().filter(j -> j.getStatus() == com.sootup.platform.model.AnalysisJob.Status.QUEUED).count());
        metrics.put("completedJobs", jobStore.list(0, 1000).stream().filter(j -> j.getStatus() == com.sootup.platform.model.AnalysisJob.Status.COMPLETED).count());
        metrics.put("failedJobs", jobStore.list(0, 1000).stream().filter(j -> j.getStatus() == com.sootup.platform.model.AnalysisJob.Status.FAILED).count());
        metrics.put("heapUsedMb", usedMem / 1024 / 1024);
        metrics.put("heapTotalMb", totalMem / 1024 / 1024);
        metrics.put("heapMaxMb", rt.maxMemory() / 1024 / 1024);
        metrics.put("heapUsedPct", (int)((double) usedMem / rt.maxMemory() * 100));
        metrics.put("availableProcessors", rt.availableProcessors());
        metrics.put("activeThreads", Thread.activeCount());
        metrics.put("sinkCatalogSize", analysisService.getSinkCatalog().size());
        return ResponseEntity.ok(metrics);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // GM-8: Bookmarks — POST/GET /api/v1/bookmarks
    // ══════════════════════════════════════════════════════════════════════════
    @PostMapping("/bookmarks")
    public ResponseEntity<?> saveBookmark(@RequestBody Map<String, Object> body) {
        String id = java.util.UUID.randomUUID().toString().substring(0, 8);
        body.put("id", id);
        body.put("createdAt", System.currentTimeMillis());
        bookmarks.put(id, body);
        return ResponseEntity.ok(Map.of("id", id, "shareUrl", "/share/" + id));
    }

    @GetMapping("/bookmarks/{id}")
    public ResponseEntity<?> getBookmark(@PathVariable String id) {
        Map<String, Object> bm = bookmarks.get(id);
        return bm != null ? ResponseEntity.ok(bm) : ResponseEntity.notFound().build();
    }

    @GetMapping("/bookmarks")
    public ResponseEntity<?> listBookmarks() {
        return ResponseEntity.ok(bookmarks.values());
    }

    // GM-3: Custom Taint Rules per job
    @PostMapping("/analyses/{jobId}/taint-rules")
    public ResponseEntity<?> setTaintRules(@PathVariable String jobId, @RequestBody Map<String, Object> body) {
        Optional<AnalysisJob> opt = jobStore.get(jobId);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        // Store in job metadata (simplified — stored as external vulnerabilities for display)
        Map<String, Object> ruleEntry = new LinkedHashMap<>();
        ruleEntry.put("type", "custom-taint-rule");
        ruleEntry.put("data", body);
        opt.get().getExternalVulnerabilities().add(ruleEntry);
        jobStore.save(opt.get());
        return ResponseEntity.ok(Map.of("status", "saved", "jobId", jobId));
    }
}
