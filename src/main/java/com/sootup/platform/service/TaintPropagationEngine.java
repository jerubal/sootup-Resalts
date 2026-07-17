package com.sootup.platform.service;

import com.sootup.platform.dto.TaintChain;
import com.sootup.platform.model.AnalysisJob;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import sootup.core.graph.StmtGraph;
import sootup.core.jimple.common.expr.AbstractInvokeExpr;
import sootup.core.jimple.common.stmt.JAssignStmt;
import sootup.core.jimple.common.stmt.JInvokeStmt;
import sootup.core.jimple.common.stmt.Stmt;
import sootup.core.model.SootMethod;
import sootup.core.signatures.MethodSignature;
import sootup.java.core.views.JavaView;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class TaintPropagationEngine {

    private static final Logger log = LoggerFactory.getLogger(TaintPropagationEngine.class);
    private static final int MAX_CALL_DEPTH = 6;

    public List<TaintChain> analyzeTaintFlows(
            AnalysisJob job, 
            JavaView view, 
            List<String> loadedClasses, 
            Map<String, String> sourceCatalog, 
            Map<String, String> sinkCatalog,
            Map<String, String> sanitizerCatalog) {
        
        // Merge custom rules into catalogs
        Map<String, String> activeSources = new HashMap<>(sourceCatalog != null ? sourceCatalog : Collections.emptyMap());
        Map<String, String> activeSinks = new HashMap<>(sinkCatalog != null ? sinkCatalog : Collections.emptyMap());
        Map<String, String> activeSanitizers = new HashMap<>(sanitizerCatalog != null ? sanitizerCatalog : Collections.emptyMap());
        
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
                        } else if ("sanitizer".equalsIgnoreCase(type)) {
                            activeSanitizers.put(pattern, "DEFAULT");
                        }
                    }
                }
            }
        }

        List<TaintChain> findings = new ArrayList<>();
        log.info("Starting interprocedural variable-tracking taint propagation for job {}", job.getJobId());

        // Locate all methods and cache them
        Map<String, SootMethod> allMethods = new HashMap<>();
        for (String className : loadedClasses) {
            view.getClass(view.getIdentifierFactory().getClassType(className)).ifPresent(sootClass -> {
                for (SootMethod method : sootClass.getMethods()) {
                    allMethods.put(method.getSignature().toString(), method);
                }
            });
        }

        // Run interprocedural analysis starting from source call sites
        for (SootMethod method : allMethods.values()) {
            if (method.getBody() == null) continue;

            StmtGraph<?> stmtGraph = method.getBody().getStmtGraph();
            List<? extends Stmt> stmts = stmtGraph.getStmts();

            for (Stmt stmt : stmts) {
                // Check if statement contains a source call
                AbstractInvokeExpr invokeExpr = null;
                if (stmt instanceof JAssignStmt && ((JAssignStmt) stmt).getRightOp() instanceof AbstractInvokeExpr) {
                    invokeExpr = (AbstractInvokeExpr) ((JAssignStmt) stmt).getRightOp();
                } else if (stmt instanceof JInvokeStmt) {
                    invokeExpr = (AbstractInvokeExpr) ((JInvokeStmt) stmt).getInvokeExpr();
                }

                if (invokeExpr != null) {
                    MethodSignature calleeSig = invokeExpr.getMethodSignature();
                    String srcCat = matchCatalog(calleeSig, activeSources);
                    if (srcCat != null) {
                        // Taint source triggered!
                        String taintedLocal = null;
                        if (stmt instanceof JAssignStmt) {
                            taintedLocal = ((JAssignStmt) stmt).getLeftOp().toString();
                        }
                        
                        Set<String> taintedLocals = new HashSet<>();
                        if (taintedLocal != null) {
                            taintedLocals.add(taintedLocal);
                        }

                        List<String> path = new ArrayList<>();
                        path.add(calleeSig.toString());
                        path.add(method.getSignature().toString());

                        Set<String> visited = new HashSet<>();
                        visited.add(method.getSignature().toString());

                        propagateTaintRecursive(
                            method, 
                            taintedLocals, 
                            path, 
                            1, 
                            allMethods, 
                            activeSources, 
                            activeSinks, 
                            activeSanitizers, 
                            findings, 
                            visited
                        );
                    }
                }
            }
        }

        // FR-M: Apply business-context risk multipliers
        Map<String, Map<String, Object>> businessTags = job.getBusinessTags();
        if (businessTags != null && !businessTags.isEmpty()) {
            for (TaintChain chain : findings) {
                String sinkSig  = chain.getSink()   != null ? chain.getSink()   : "";
                String srcSig   = chain.getSource() != null ? chain.getSource() : "";
                for (Map.Entry<String, Map<String, Object>> tagEntry : businessTags.entrySet()) {
                    String pat = tagEntry.getKey();
                    if (sinkSig.contains(pat) || srcSig.contains(pat)) {
                        Map<String, Object> tagData = tagEntry.getValue();
                        double multiplier = Double.parseDouble(String.valueOf(tagData.getOrDefault("multiplier", "1.0")));
                        String tagLabel   = String.valueOf(tagData.getOrDefault("label", "business-critical"));
                        chain.setBusinessTag(tagLabel);
                        chain.setBusinessMultiplier(multiplier);
                        break; 
                    }
                }
            }
            findings.sort((a, b) -> Double.compare(b.getBusinessMultiplier(), a.getBusinessMultiplier()));
        }

        return findings;
    }

    private boolean propagateTaintRecursive(
            SootMethod method,
            Set<String> taintedLocals,
            List<String> currentPath,
            int depth,
            Map<String, SootMethod> allMethods,
            Map<String, String> sources,
            Map<String, String> sinks,
            Map<String, String> sanitizers,
            List<TaintChain> findings,
            Set<String> visited) {

        if (depth > MAX_CALL_DEPTH || method.getBody() == null) {
            return false;
        }

        StmtGraph<?> stmtGraph = method.getBody().getStmtGraph();
        List<? extends Stmt> stmts = stmtGraph.getStmts();
        boolean returnsTaintedLocal = false;

        for (Stmt stmt : stmts) {
            // Extract call site if any
            AbstractInvokeExpr invokeExpr = null;
            if (stmt instanceof JAssignStmt && ((JAssignStmt) stmt).getRightOp() instanceof AbstractInvokeExpr) {
                invokeExpr = (AbstractInvokeExpr) ((JAssignStmt) stmt).getRightOp();
            } else if (stmt instanceof JInvokeStmt) {
                invokeExpr = (AbstractInvokeExpr) ((JInvokeStmt) stmt).getInvokeExpr();
            }

            // Case 1: Sanitizer call check
            if (invokeExpr != null) {
                String sanitizerCat = matchCatalog(invokeExpr.getMethodSignature(), sanitizers);
                if (sanitizerCat != null) {
                    if (stmt instanceof JAssignStmt) {
                        String leftOp = ((JAssignStmt) stmt).getLeftOp().toString();
                        taintedLocals.remove(leftOp);
                    }
                    for (Object arg : invokeExpr.getArgs()) {
                        taintedLocals.remove(arg.toString());
                    }
                    continue; 
                }
            }

            // Case 2: Assignment Stmt
            if (stmt instanceof JAssignStmt) {
                JAssignStmt assign = (JAssignStmt) stmt;
                String leftOp = assign.getLeftOp().toString();
                String rightOp = assign.getRightOp().toString();

                boolean rhsTainted = false;
                for (String tainted : taintedLocals) {
                    if (Pattern.compile("\\b" + Pattern.quote(tainted) + "\\b").matcher(rightOp).find()) {
                        rhsTainted = true;
                        break;
                    }
                }

                if (rhsTainted) {
                    taintedLocals.add(leftOp);
                }
            }

            // Case 3: Interprocedural Call site
            if (invokeExpr != null) {
                MethodSignature calleeSig = invokeExpr.getMethodSignature();
                
                // Check if any argument is tainted
                List<Integer> taintedArgIndices = new ArrayList<>();
                List<Object> args = invokeExpr.getArgs();
                for (int i = 0; i < args.size(); i++) {
                    String argStr = args.get(i).toString();
                    for (String tainted : taintedLocals) {
                        if (Pattern.compile("\\b" + Pattern.quote(tainted) + "\\b").matcher(argStr).find()) {
                            taintedArgIndices.add(i);
                            break;
                        }
                    }
                }

                if (!taintedArgIndices.isEmpty()) {
                    // Check if callee signature is a direct sink
                    String sinkRisk = matchCatalog(calleeSig, sinks);
                    if (sinkRisk != null) {
                        List<String> fullPath = new ArrayList<>(currentPath);
                        fullPath.add(calleeSig.toString());
                        
                        TaintChain tc = new TaintChain(
                            currentPath.get(0),
                            sources.getOrDefault(currentPath.get(0), "VARIABLE"),
                            calleeSig.toString(),
                            sinkRisk,
                            fullPath
                        );
                        
                        // TASK 4: Confidence scoring heuristic
                        String confidence = (fullPath.size() <= 3) ? "high" : "medium";
                        tc.setConfidence(confidence);

                        // Deduplicate findings
                        boolean isDup = false;
                        for (TaintChain f : findings) {
                            if (f.getSource().equals(tc.getSource()) && f.getSink().equals(tc.getSink())) {
                                isDup = true;
                                break;
                            }
                        }
                        if (!isDup) {
                            findings.add(tc);
                        }
                    }

                    // Recursively propagate parameter taint inside callee
                    SootMethod calleeMethod = allMethods.get(calleeSig.toString());
                    if (calleeMethod != null && calleeMethod.getBody() != null) {
                        String calleeKey = calleeSig.toString();
                        if (visited.add(calleeKey)) {
                            // Find matching parameter locals inside callee
                            Set<String> calleeTaintedLocals = new HashSet<>();
                            StmtGraph<?> calleeGraph = calleeMethod.getBody().getStmtGraph();
                            for (Stmt calleeStmt : calleeGraph.getStmts()) {
                                if (calleeStmt instanceof JAssignStmt) {
                                    JAssignStmt cAssign = (JAssignStmt) calleeStmt;
                                    String rightOp = cAssign.getRightOp().toString();
                                    for (int tIdx : taintedArgIndices) {
                                        if (rightOp.contains("@parameter" + tIdx)) {
                                            calleeTaintedLocals.add(cAssign.getLeftOp().toString());
                                        }
                                    }
                                }
                            }

                            if (!calleeTaintedLocals.isEmpty()) {
                                List<String> calleePath = new ArrayList<>(currentPath);
                                calleePath.add(calleeSig.toString());

                                boolean calleeReturnsTaint = propagateTaintRecursive(
                                    calleeMethod,
                                    calleeTaintedLocals,
                                    calleePath,
                                    depth + 1,
                                    allMethods,
                                    sources,
                                    sinks,
                                    sanitizers,
                                    findings,
                                    visited
                                );

                                // If callee return value can be tainted, taint caller's receiving variable
                                if (calleeReturnsTaint && stmt instanceof JAssignStmt) {
                                    taintedLocals.add(((JAssignStmt) stmt).getLeftOp().toString());
                                }
                            }
                            visited.remove(calleeKey);
                        }
                    }
                }
            }

            // Case 4: Return stmt check
            if (stmt.toString().startsWith("return ")) {
                String retVal = stmt.toString().substring(7).replace(";", "").trim();
                for (String tainted : taintedLocals) {
                    if (retVal.equals(tainted)) {
                        returnsTaintedLocal = true;
                        break;
                    }
                }
            }
        }

        return returnsTaintedLocal;
    }

    private boolean signatureMatchesPattern(MethodSignature sig, String pattern) {
        String sigStr = sig.toString();
        if (pattern.endsWith(".*")) {
            String pkgPrefix = pattern.substring(0, pattern.length() - 2);
            return sig.getDeclClassType().toString().startsWith(pkgPrefix);
        }
        int lastDot = pattern.lastIndexOf('.');
        if (lastDot > 0) {
            String className = pattern.substring(0, lastDot);
            String methodName = pattern.substring(lastDot + 1);
            return sig.getDeclClassType().toString().equals(className) && sig.getName().equals(methodName);
        }
        return sigStr.contains(pattern);
    }

    private String matchCatalog(MethodSignature sig, Map<String, String> catalog) {
        for (Map.Entry<String, String> entry : catalog.entrySet()) {
            if (signatureMatchesPattern(sig, entry.getKey())) {
                return entry.getValue();
            }
        }
        return null;
    }
}
