package com.sootup.platform.service;

import com.sootup.platform.dto.TaintChain;
import com.sootup.platform.model.AnalysisJob;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;

@Service
public class PolicyEngine {

    private static final Logger log = LoggerFactory.getLogger(PolicyEngine.class);

    public static class PolicyRule {
        public String name;
        public String denySourceCategory;
        public String denySinkRiskCategory;

        public PolicyRule(String name, String denySourceCategory, String denySinkRiskCategory) {
            this.name = name;
            this.denySourceCategory = denySourceCategory;
            this.denySinkRiskCategory = denySinkRiskCategory;
        }
    }

    private final List<PolicyRule> rules = new ArrayList<>();

    @PostConstruct
    public void loadPolicies() {
        try (InputStream is = getClass().getClassLoader().getResourceAsStream("policies.yaml")) {
            if (is == null) {
                log.warn("policies.yaml not found — using default rules.");
                rules.add(new PolicyRule("Default block file output to network", "FILE", "NETWORK"));
                return;
            }
            try (BufferedReader br = new BufferedReader(new InputStreamReader(is))) {
                String line;
                String currentName = null;
                String currentSource = null;
                String currentSink = null;
                while ((line = br.readLine()) != null) {
                    line = line.trim();
                    if (line.startsWith("- name:")) {
                        if (currentName != null) {
                            rules.add(new PolicyRule(currentName, currentSource, currentSink));
                        }
                        currentName = line.substring("- name:".length()).trim().replaceAll("^\"|\"$", "");
                        currentSource = null;
                        currentSink = null;
                    } else if (line.startsWith("denySourceCategory:") && currentName != null) {
                        currentSource = line.substring("denySourceCategory:".length()).trim().replaceAll("^\"|\"$", "");
                    } else if (line.startsWith("denySinkRiskCategory:") && currentName != null) {
                        currentSink = line.substring("denySinkRiskCategory:".length()).trim().replaceAll("^\"|\"$", "");
                    }
                }
                if (currentName != null) {
                    rules.add(new PolicyRule(currentName, currentSource, currentSink));
                }
            }
            log.info("Loaded {} policy rules from policies.yaml", rules.size());
        } catch (Exception e) {
            log.error("Failed to load policies.yaml: {}", e.getMessage());
        }
    }

    public List<String> evaluatePolicies(List<TaintChain> taintChains) {
        List<String> violations = new ArrayList<>();
        for (TaintChain chain : taintChains) {
            for (PolicyRule rule : rules) {
                if (rule.denySourceCategory.equalsIgnoreCase(chain.getSourceCategory()) &&
                    rule.denySinkRiskCategory.equalsIgnoreCase(chain.getSinkRiskCategory())) {
                    String msg = String.format("Policy Violation [%s]: Source category '%s' flowed to Sink category '%s' via path %s",
                            rule.name, chain.getSourceCategory(), chain.getSinkRiskCategory(), chain.getPath());
                    violations.add(msg);
                }
            }
        }
        return violations;
    }
}
