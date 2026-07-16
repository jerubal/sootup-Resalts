package com.sootup.platform.service;

import com.sootup.platform.dto.GraphResponse;
import com.sootup.platform.model.AnalysisJob;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import sootup.core.graph.StmtGraph;
import sootup.core.inputlocation.AnalysisInputLocation;
import sootup.core.jimple.common.stmt.Stmt;
import sootup.core.model.SootClass;
import sootup.core.model.SootMethod;
import sootup.core.signatures.MethodSignature;
import sootup.core.types.ClassType;
import sootup.core.IdentifierFactory;
import sootup.java.bytecode.inputlocation.JrtFileSystemAnalysisInputLocation;
import sootup.java.bytecode.inputlocation.DefaultRTJarAnalysisInputLocation;
import sootup.java.bytecode.inputlocation.PathBasedAnalysisInputLocation;
import sootup.java.core.views.JavaView;
import sootup.java.core.JavaSootClass;
import sootup.callgraph.CallGraph;
import sootup.callgraph.CallGraphAlgorithm;
import sootup.callgraph.ClassHierarchyAnalysisAlgorithm;
import sootup.callgraph.RapidTypeAnalysisAlgorithm;

import jakarta.annotation.PostConstruct;
import java.io.BufferedReader;
import java.io.File;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CompletableFuture;

@Service
public class SootUpAnalysisService {

    private static final Logger log = LoggerFactory.getLogger(SootUpAnalysisService.class);
    private final ConcurrentHashMap<String, CompletableFuture<?>> runningTasks = new ConcurrentHashMap<>();

    // Taint catalogs
    private final Map<String, String> sinkCatalog = new LinkedHashMap<>();
    private final Map<String, String> sourceCatalog = new LinkedHashMap<>();

    @PostConstruct
    public void loadCatalogs() {
        loadSinkCatalog();
        loadSourceCatalog();
    }

    public void loadSinkCatalog() {
        try (InputStream is = getClass().getClassLoader().getResourceAsStream("sinks.yaml")) {
            if (is == null) { log.warn("sinks.yaml not found on classpath — sink detection disabled."); return; }
            try (BufferedReader br = new BufferedReader(new InputStreamReader(is))) {
                String line;
                String currentPattern = null;
                while ((line = br.readLine()) != null) {
                    line = line.trim();
                    if (line.startsWith("- pattern:")) {
                        currentPattern = line.substring("- pattern:".length()).trim().replaceAll("^\"|\"$", "");
                    } else if (line.startsWith("riskCategory:") && currentPattern != null) {
                        String category = line.substring("riskCategory:".length()).trim().replaceAll("^\"|\"$", "");
                        sinkCatalog.put(currentPattern, category);
                        currentPattern = null;
                    }
                }
            }
            log.info("Loaded {} sink patterns from sinks.yaml", sinkCatalog.size());
        } catch (Exception e) {
            log.error("Failed to load sinks.yaml: {}", e.getMessage());
        }
    }

    public void loadSourceCatalog() {
        try (InputStream is = getClass().getClassLoader().getResourceAsStream("sources.yaml")) {
            if (is == null) { log.warn("sources.yaml not found on classpath — source detection disabled."); return; }
            try (BufferedReader br = new BufferedReader(new InputStreamReader(is))) {
                String line;
                String currentPattern = null;
                while ((line = br.readLine()) != null) {
                    line = line.trim();
                    if (line.startsWith("- pattern:")) {
                        currentPattern = line.substring("- pattern:".length()).trim().replaceAll("^\"|\"$", "");
                    } else if (line.startsWith("sourceCategory:") && currentPattern != null) {
                        String category = line.substring("sourceCategory:".length()).trim().replaceAll("^\"|\"$", "");
                        sourceCatalog.put(currentPattern, category);
                        currentPattern = null;
                    }
                }
            }
            log.info("Loaded {} source patterns from sources.yaml", sourceCatalog.size());
        } catch (Exception e) {
            log.error("Failed to load sources.yaml: {}", e.getMessage());
        }
    }

    /** Returns the riskCategory if the method signature matches a known sink, else null. */
    private String matchSink(String methodSig) {
        for (Map.Entry<String, String> entry : sinkCatalog.entrySet()) {
            if (methodSig.contains(entry.getKey())) return entry.getValue();
        }
        return null;
    }

    /** Returns the sourceCategory if the method signature matches a known source, else null. */
    private String matchSource(String methodSig) {
        for (Map.Entry<String, String> entry : sourceCatalog.entrySet()) {
            if (methodSig.contains(entry.getKey())) return entry.getValue();
        }
        return null;
    }

    @Async("analysisTaskExecutor")
    public void runAnalysis(AnalysisJob job) {
        CompletableFuture<Void> future = new CompletableFuture<>();
        runningTasks.put(job.getJobId(), future);

        try {
            job.setStatus(AnalysisJob.Status.RUNNING);
            job.setProgress(10);
            job.setMessage("Initializing SootUp environments...");

            // Sanitize target path against path traversal
            Path targetPath = Paths.get(job.getRequest().getTargetPath()).normalize().toAbsolutePath();
            if (targetPath.toString().contains("..")) {
                throw new SecurityException("Potential path traversal detected in target path: " + targetPath);
            }

            // Create input locations list
            List<AnalysisInputLocation> inputLocations = new ArrayList<>();
            inputLocations.add(PathBasedAnalysisInputLocation.create(targetPath, null));

            // Attach JDK stub/runtime
            int version = job.getRequest().getBytecodeVersion();
            if (version >= 9) {
                inputLocations.add(new JrtFileSystemAnalysisInputLocation());
            } else {
                inputLocations.add(new DefaultRTJarAnalysisInputLocation());
            }

            job.setProgress(30);
            job.setMessage("Building SootUp View...");

            // Build JavaView directly
            JavaView view = new JavaView(inputLocations);

            job.setProgress(50);
            job.setMessage("Extracting classes and methods...");

            // Scan directory/jar for target classes specifically to avoid scanning JDK classes
            List<String> targetClassNames = findClassNames(targetPath);
            if (targetClassNames.isEmpty() && job.getRequest().getEntryPoints() != null) {
                // If it's a specific single class or empty dir, add the entry point class
                for (String ep : job.getRequest().getEntryPoints()) {
                    String clean = ep.trim().replace("<", "").replace(">", "");
                    if (clean.contains(":")) {
                        targetClassNames.add(clean.split(":")[0].trim());
                    } else {
                        targetClassNames.add(clean);
                    }
                }
            }

            List<String> loadedClasses = new ArrayList<>();
            Map<String, String> methodJimpleMap = job.getMethodJimpleMap();
            Map<String, GraphResponse> methodCfgMap = job.getMethodCfgMap();

            int totalMethods = 0;
            IdentifierFactory factory = view.getIdentifierFactory();
            
            for (String className : targetClassNames) {
                ClassType classType = factory.getClassType(className);
                Optional<JavaSootClass> optClass = view.getClass(classType);
                if (optClass.isPresent()) {
                    JavaSootClass sootClass = optClass.get();
                    loadedClasses.add(sootClass.getName());

                    for (SootMethod method : sootClass.getMethods()) {
                        totalMethods++;
                        String methodSig = method.getSignature().toString();

                        if (job.getRequest().getAnalysisFlags().contains("jimple")) {
                            methodJimpleMap.put(methodSig, method.getBody().toString());
                        }

                        if (job.getRequest().getAnalysisFlags().contains("cfg")) {
                            GraphResponse cfgGraph = buildCfgGraph(method);
                            methodCfgMap.put(methodSig, cfgGraph);
                        }
                    }
                }
            }
            job.setLoadedClasses(loadedClasses);
            job.setMethodCount(totalMethods);

            // Compute Call Graph if requested
            if (job.getRequest().getAnalysisFlags().contains("callGraph")) {
                job.setProgress(70);
                job.setMessage("Constructing Call Graph...");

                List<MethodSignature> resolvedEntries = resolveEntryPoints(view, job.getRequest().getEntryPoints());
                if (resolvedEntries.isEmpty()) {
                    throw new IllegalArgumentException("No valid entry points could be resolved from: " + job.getRequest().getEntryPoints());
                }

                CallGraphAlgorithm cgAlgorithm;
                if ("RTA".equalsIgnoreCase(job.getRequest().getCgAlgorithm())) {
                    cgAlgorithm = new RapidTypeAnalysisAlgorithm(view);
                } else {
                    cgAlgorithm = new ClassHierarchyAnalysisAlgorithm(view);
                }

                CallGraph cg = cgAlgorithm.initialize(resolvedEntries);
                GraphResponse callGraphResponse = convertCallGraphToResponse(cg, resolvedEntries);
                job.setCallGraph(callGraphResponse);
                job.setEdgeCount(callGraphResponse.getEdges().size());
            }

            job.setProgress(100);
            job.setStatus(AnalysisJob.Status.COMPLETED);
            job.setMessage("Analysis completed successfully.");
            job.setCompletedAt(System.currentTimeMillis());

        } catch (SecurityException e) {
            job.setStatus(AnalysisJob.Status.FAILED);
            job.setMessage("Security Error: " + e.getMessage());
            job.setCompletedAt(System.currentTimeMillis());
        } catch (Exception e) {
            job.setStatus(AnalysisJob.Status.FAILED);
            job.setMessage("Analysis failed: " + e.getMessage());
            job.setCompletedAt(System.currentTimeMillis());
        } finally {
            runningTasks.remove(job.getJobId());
            future.complete(null);
            
            // Aggressively trigger JVM GC to free loaded view class allocations
            System.gc();
        }
    }

    public boolean cancelJob(String jobId) {
        CompletableFuture<?> future = runningTasks.remove(jobId);
        if (future != null) {
            future.cancel(true);
            return true;
        }
        return false;
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private GraphResponse buildCfgGraph(SootMethod method) {
        List<GraphResponse.Node> nodes = new ArrayList<>();
        List<GraphResponse.Edge> edges = new ArrayList<>();
        
        String methodSig = method.getSignature().toString();
        StmtGraph<?> stmtGraph = method.getBody().getStmtGraph();
        List<? extends Stmt> stmts = stmtGraph.getStmts();

        for (int i = 0; i < stmts.size(); i++) {
            Stmt stmt = stmts.get(i);
            String label = stmt.toString();
            String nodeId = methodSig + "#" + i;

            Map<String, Object> nodeData = new HashMap<>();
            nodeData.put("id", nodeId);
            nodeData.put("label", label);
            nodes.add(new GraphResponse.Node(nodeData));
        }

        for (int i = 0; i < stmts.size(); i++) {
            Stmt stmt = stmts.get(i);
            String sourceId = methodSig + "#" + i;
            List<?> succs = ((StmtGraph) stmtGraph).successors(stmt); // Use correct successors() method

            for (Object succ : succs) {
                int succIndex = stmts.indexOf(succ);
                if (succIndex != -1) {
                    String targetId = methodSig + "#" + succIndex;
                    String edgeId = sourceId + "->" + targetId;

                    Map<String, Object> edgeData = new HashMap<>();
                    edgeData.put("id", edgeId);
                    edgeData.put("source", sourceId);
                    edgeData.put("target", targetId);
                    edges.add(new GraphResponse.Edge(edgeData));
                }
            }
        }

        return new GraphResponse(nodes, edges);
    }

    private List<String> findClassNames(Path targetPath) {
        List<String> classNames = new ArrayList<>();
        File file = targetPath.toFile();
        if (file.isDirectory()) {
            scanDirectory(file, "", classNames);
        } else if (file.isFile() && (file.getName().endsWith(".jar") || file.getName().endsWith(".war"))) {
            scanJar(file, classNames);
        }
        return classNames;
    }

    private void scanDirectory(File dir, String pkg, List<String> classNames) {
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File f : files) {
            if (f.isDirectory()) {
                String nextPkg = pkg.isEmpty() ? f.getName() : pkg + "." + f.getName();
                scanDirectory(f, nextPkg, classNames);
            } else if (f.isFile() && f.getName().endsWith(".class")) {
                String className = f.getName().substring(0, f.getName().length() - 6);
                classNames.add(pkg.isEmpty() ? className : pkg + "." + className);
            }
        }
    }

    private void scanJar(File jarFile, List<String> classNames) {
        try (java.util.jar.JarFile jar = new java.util.jar.JarFile(jarFile)) {
            Enumeration<java.util.jar.JarEntry> entries = jar.entries();
            while (entries.hasMoreElements()) {
                java.util.jar.JarEntry entry = entries.nextElement();
                if (!entry.isDirectory() && entry.getName().endsWith(".class")) {
                    String name = entry.getName().replace('/', '.');
                    name = name.substring(0, name.length() - 6);
                    classNames.add(name);
                }
            }
        } catch (Exception e) {
            // Ignored
        }
    }

    private List<MethodSignature> resolveEntryPoints(JavaView view, List<String> entryPointStrings) {
        List<MethodSignature> entryPoints = new ArrayList<>();
        IdentifierFactory factory = view.getIdentifierFactory();

        for (String eps : entryPointStrings) {
            String clean = eps.trim().replace("<", "").replace(">", "");

            if (clean.contains(":")) {
                String[] parts = clean.split(":");
                String className = parts[0].trim();
                String methodPart = parts[1].trim();

                int openParen = methodPart.indexOf('(');
                int closeParen = methodPart.indexOf(')');
                if (openParen != -1 && closeParen != -1) {
                    String returnAndName = methodPart.substring(0, openParen).trim();
                    int lastSpace = returnAndName.lastIndexOf(' ');
                    String returnType = lastSpace != -1 ? returnAndName.substring(0, lastSpace).trim() : "void";
                    String methodName = lastSpace != -1 ? returnAndName.substring(lastSpace).trim() : returnAndName;

                    String paramsStr = methodPart.substring(openParen + 1, closeParen).trim();
                    List<String> paramTypes = new ArrayList<>();
                    if (!paramsStr.isEmpty()) {
                        for (String p : paramsStr.split(",")) {
                            paramTypes.add(p.trim());
                        }
                    }

                    ClassType classType = factory.getClassType(className);
                    MethodSignature methodSig = factory.getMethodSignature(classType, methodName, returnType, paramTypes);
                    entryPoints.add(methodSig);
                    continue;
                }
            }

            ClassType classType = factory.getClassType(clean);
            Optional<JavaSootClass> optClass = view.getClass(classType);
            if (optClass.isPresent()) {
                SootClass sootClass = optClass.get();
                boolean foundMain = false;
                for (SootMethod method : sootClass.getMethods()) {
                    if ("main".equals(method.getName())) {
                        entryPoints.add(method.getSignature());
                        foundMain = true;
                        break;
                    }
                }
                if (!foundMain && !sootClass.getMethods().isEmpty()) {
                    entryPoints.add(sootClass.getMethods().iterator().next().getSignature());
                }
            } else {
                int lastDot = clean.lastIndexOf('.');
                if (lastDot != -1) {
                    String className = clean.substring(0, lastDot);
                    String methodName = clean.substring(lastDot + 1);
                    ClassType cType = factory.getClassType(className);
                    Optional<JavaSootClass> cOpt = view.getClass(cType);
                    if (cOpt.isPresent()) {
                        for (SootMethod m : cOpt.get().getMethods()) {
                            if (m.getName().equals(methodName)) {
                                entryPoints.add(m.getSignature());
                                break;
                            }
                        }
                    }
                }
            }
        }
        return entryPoints;
    }

    private GraphResponse convertCallGraphToResponse(CallGraph callGraph, List<MethodSignature> entryPoints) {
        // ── Phase 1: BFS to discover all reachable nodes/edges ──────────────────
        Queue<MethodSignature> queue = new LinkedList<>(entryPoints);
        Set<MethodSignature> visited = new HashSet<>(entryPoints);
        // reachableFromEntry: BFS-reachable set (FR-3b)
        Set<String> reachableIds = new HashSet<>();
        List<GraphResponse.Node> nodes = new ArrayList<>();
        List<GraphResponse.Edge> edges = new ArrayList<>();

        // Seed entry-point nodes
        for (MethodSignature entry : entryPoints) {
            reachableIds.add(entry.toString());
        }

        while (!queue.isEmpty()) {
            MethodSignature current = queue.poll();
            reachableIds.add(current.toString());
            Collection<MethodSignature> callees = callGraph.callsFrom(current);
            for (MethodSignature callee : callees) {
                String edgeId = current.toString() + "->" + callee.toString();
                Map<String, Object> edgeData = new HashMap<>();
                edgeData.put("id", edgeId);
                edgeData.put("source", current.toString());
                edgeData.put("target", callee.toString());
                edges.add(new GraphResponse.Edge(edgeData));

                if (visited.add(callee)) {
                    reachableIds.add(callee.toString());
                    queue.add(callee);
                }
            }
        }

        // ── Phase 2: Build nodes with riskCategory + reachableFromEntry tags ────
        for (MethodSignature sig : visited) {
            String sigStr = sig.toString();
            Map<String, Object> nodeData = new HashMap<>();
            nodeData.put("id", sigStr);
            nodeData.put("label", sig.getName());
            nodeData.put("class", sig.getDeclClassType().toString());
            nodeData.put("reachableFromEntry", reachableIds.contains(sigStr));

            // Server-side sink detection from configurable catalog (FR-3a)
            String riskCategory = matchSink(sigStr);
            if (riskCategory != null) {
                nodeData.put("riskCategory", riskCategory);
            }

            // Server-side source detection
            String srcCat = matchSource(sigStr);
            if (srcCat != null) {
                nodeData.put("sourceCategory", srcCat);
            }

            nodes.add(new GraphResponse.Node(nodeData));
        }

        return new GraphResponse(nodes, edges);
    }

    /** Computes taint chains by traversing the call graph from identified sources to sinks. */
    public List<com.sootup.platform.dto.TaintChain> computeTaintChains(AnalysisJob job) {
        GraphResponse cg = job.getCallGraph();
        if (cg == null) return Collections.emptyList();

        List<GraphResponse.Node> nodes = cg.getNodes();
        List<GraphResponse.Edge> edges = cg.getEdges();

        // Build adjacency list for forward traversal
        Map<String, List<String>> adj = new HashMap<>();
        for (GraphResponse.Edge edge : edges) {
            String src = String.valueOf(edge.getData().get("source"));
            String tgt = String.valueOf(edge.getData().get("target"));
            adj.computeIfAbsent(src, k -> new ArrayList<>()).add(tgt);
        }

        // Identify all source & sink nodes
        Map<String, String> sources = new HashMap<>();
        Map<String, String> sinks = new HashMap<>();

        for (GraphResponse.Node node : nodes) {
            String id = String.valueOf(node.getData().get("id"));
            
            String srcCat = matchSource(id);
            if (srcCat != null) {
                sources.put(id, srcCat);
            }

            String sinkRisk = matchSink(id);
            if (sinkRisk != null) {
                sinks.put(id, sinkRisk);
            }
        }

        List<com.sootup.platform.dto.TaintChain> chains = new ArrayList<>();

        // BFS path finding from every source to locate paths to any sink
        for (Map.Entry<String, String> sourceEntry : sources.entrySet()) {
            String startNode = sourceEntry.getKey();
            String srcCategory = sourceEntry.getValue();

            // Run BFS
            Queue<String> queue = new LinkedList<>();
            Map<String, String> parent = new HashMap<>();
            Set<String> visited = new HashSet<>();

            queue.add(startNode);
            visited.add(startNode);

            while (!queue.isEmpty()) {
                String current = queue.poll();

                // If current node is a sink, build the path and record the taint chain
                if (sinks.containsKey(current) && !current.equals(startNode)) {
                    List<String> path = new ArrayList<>();
                    String curr = current;
                    while (curr != null) {
                        path.add(curr);
                        curr = parent.get(curr);
                    }
                    Collections.reverse(path);
                    
                    chains.add(new com.sootup.platform.dto.TaintChain(
                        startNode, srcCategory,
                        current, sinks.get(current),
                        path
                    ));
                }

                List<String> neighbors = adj.getOrDefault(current, Collections.emptyList());
                for (String neighbor : neighbors) {
                    if (visited.add(neighbor)) {
                        parent.put(neighbor, current);
                        queue.add(neighbor);
                    }
                }
            }
        }

        return chains;
    }
}
