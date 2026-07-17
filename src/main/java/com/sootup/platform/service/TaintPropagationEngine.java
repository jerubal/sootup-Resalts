package com.sootup.platform.service;

import com.sootup.platform.dto.TaintChain;
import com.sootup.platform.model.AnalysisJob;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import sootup.core.graph.StmtGraph;
import sootup.core.jimple.common.expr.AbstractInvokeExpr;
import sootup.core.jimple.common.ref.JInstanceFieldRef;
import sootup.core.jimple.common.stmt.JAssignStmt;
import sootup.core.jimple.common.stmt.JInvokeStmt;
import sootup.core.jimple.common.stmt.Stmt;
import sootup.core.model.SootMethod;
import sootup.core.signatures.MethodSignature;
import sootup.java.core.JavaSootClass;
import sootup.java.core.views.JavaView;

import java.util.*;

@Service
public class TaintPropagationEngine {

    private static final Logger log = LoggerFactory.getLogger(TaintPropagationEngine.class);

    public List<TaintChain> analyzeTaintFlows(AnalysisJob job, JavaView view, List<String> loadedClasses, Map<String, String> sourceCatalog, Map<String, String> sinkCatalog) {
        // Merge custom job rules
        Map<String, String> activeSources = new HashMap<>(sourceCatalog != null ? sourceCatalog : Collections.emptyMap());
        Map<String, String> activeSinks = new HashMap<>(sinkCatalog != null ? sinkCatalog : Collections.emptyMap());
        
        if (job.getCustomTaintRules() != null) {
            for (Map<String, Object> ruleWrapper : job.getCustomTaintRules()) {
                @SuppressWarnings("unchecked")
                Map<String, Object> ruleData = (Map<String, Object>) ruleWrapper.get("data");
                if (ruleData != null) {
                    String pattern = String.valueOf(ruleData.get("pattern"));
                    String type = String.valueOf(ruleData.get("type"));
                    String category = String.valueOf(ruleData.get("category"));
                    if (category == null || "null".equals(category)) {
                        category = String.valueOf(ruleData.get("riskCategory")); // fallback
                    }
                    if (pattern != null && !"null".equals(pattern)) {
                        if ("source".equalsIgnoreCase(type)) {
                            activeSources.put(pattern, category != null && !"null".equals(category) ? category : "CUSTOM_SOURCE");
                        } else if ("sink".equalsIgnoreCase(type)) {
                            activeSinks.put(pattern, category != null && !"null".equals(category) ? category : "CUSTOM_SINK");
                        }
                    }
                }
            }
        }

        List<TaintChain> findings = new ArrayList<>();
        log.info("Starting CFG-based variable tracking taint propagation for job {}", job.getJobId());

        for (String className : loadedClasses) {
            view.getClass(view.getIdentifierFactory().getClassType(className)).ifPresent(sootClass -> {
                for (SootMethod method : sootClass.getMethods()) {
                    if (method.getBody() == null) continue;

                    findings.addAll(analyzeMethod(method, activeSources, activeSinks));
                }
            });
        }

        return findings;
    }

    private List<TaintChain> analyzeMethod(SootMethod method, Map<String, String> sourceCatalog, Map<String, String> sinkCatalog) {
        List<TaintChain> methodFindings = new ArrayList<>();
        String methodSig = method.getSignature().toString();

        StmtGraph<?> stmtGraph = method.getBody().getStmtGraph();
        List<? extends Stmt> stmts = stmtGraph.getStmts();

        // Map to keep track of tainted variables/locals
        Set<String> taintedLocals = new HashSet<>();
        
        // Track the statement path where a local became tainted
        Map<String, List<String>> taintPaths = new HashMap<>();

        for (Stmt stmt : stmts) {

            // Case 1: Assignment Stmt
            if (stmt instanceof JAssignStmt) {
                @SuppressWarnings("unchecked")
                JAssignStmt assign = (JAssignStmt) stmt;
                String leftOp = assign.getLeftOp().toString();
                String rightOp = assign.getRightOp().toString();

                boolean rhsTainted = false;
                String detectedSource = null;
                String detectedSourceCat = null;

                // Check if right-hand side invokes a Source
                if (assign.getRightOp() instanceof AbstractInvokeExpr) {
                    AbstractInvokeExpr invoke = (AbstractInvokeExpr) assign.getRightOp();
                    String calleeSig = invoke.getMethodSignature().toString();
                    String srcCat = matchCatalog(calleeSig, sourceCatalog);
                    if (srcCat != null) {
                        rhsTainted = true;
                        detectedSource = calleeSig;
                        detectedSourceCat = srcCat;
                    }
                }

                // Check if right-hand side uses an already tainted local variable
                for (String tainted : taintedLocals) {
                    if (rightOp.contains(tainted)) {
                        rhsTainted = true;
                        if (detectedSource == null) {
                            // Inherit source details
                            List<String> parentPath = taintPaths.get(tainted);
                            if (parentPath != null && !parentPath.isEmpty()) {
                                detectedSource = parentPath.get(0);
                            }
                        }
                        break;
                    }
                }

                if (rhsTainted) {
                    taintedLocals.add(leftOp);
                    List<String> path = new ArrayList<>();
                    path.add(detectedSource != null ? detectedSource : rightOp);
                    path.add(methodSig);
                    taintPaths.put(leftOp, path);
                }
            }
            // Case 2: Checking Sinks (could be JInvokeStmt or JAssignStmt containing InvokeExpr)
            AbstractInvokeExpr invokeExpr = null;
            if (stmt instanceof JInvokeStmt) {
                invokeExpr = (AbstractInvokeExpr) ((JInvokeStmt) stmt).getInvokeExpr();
            } else if (stmt instanceof JAssignStmt && ((JAssignStmt) stmt).getRightOp() instanceof AbstractInvokeExpr) {
                invokeExpr = (AbstractInvokeExpr) ((JAssignStmt) stmt).getRightOp();
            }

            if (invokeExpr != null) {
                String calleeSig = invokeExpr.getMethodSignature().toString();
                String sinkRisk = matchCatalog(calleeSig, sinkCatalog);

                if (sinkRisk != null) {
                    // Check if any argument is tainted
                    for (Object arg : invokeExpr.getArgs()) {
                        String argStr = arg.toString();
                        for (String tainted : taintedLocals) {
                            if (argStr.contains(tainted)) {
                                // Match! Taint propagated into a Sink argument!
                                List<String> path = new ArrayList<>(taintPaths.get(tainted));
                                path.add(calleeSig);

                                methodFindings.add(new TaintChain(
                                    path.get(0), 
                                    matchCatalog(path.get(0), sourceCatalog) != null ? matchCatalog(path.get(0), sourceCatalog) : "VARIABLE",
                                    calleeSig, 
                                    sinkRisk, 
                                    path
                                ));
                                break;
                            }
                        }
                    }
                }
            }
        }

        return methodFindings;
    }

    private String matchCatalog(String sig, Map<String, String> catalog) {
        for (Map.Entry<String, String> entry : catalog.entrySet()) {
            if (sig.contains(entry.getKey())) return entry.getValue();
        }
        return null;
    }
}
