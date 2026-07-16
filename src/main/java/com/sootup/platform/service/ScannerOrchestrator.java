package com.sootup.platform.service;

import com.sootup.platform.model.AnalysisJob;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ScannerOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(ScannerOrchestrator.class);

    public static class Vulnerability {
        public String scanner;
        public String severity;
        public String ruleId;
        public String description;
        public String targetFile;

        public Vulnerability(String scanner, String severity, String ruleId, String description, String targetFile) {
            this.scanner = scanner;
            this.severity = severity;
            this.ruleId = ruleId;
            this.description = description;
            this.targetFile = targetFile;
        }
    }

    public List<Vulnerability> runExternalScans(AnalysisJob job) {
        List<Vulnerability> report = new ArrayList<>();
        String targetName = job.getRequest().getTargetPath();
        log.info("Orchestrating third-party scanners for target: {}", targetName);

        // Simulate Semgrep scan
        log.info("Running Semgrep scanner...");
        report.add(new Vulnerability(
            "Semgrep", 
            "HIGH", 
            "java.lang.security.audit.crypto.weak-hash",
            "Detected weak hashing algorithm (MD5/SHA1) usage in class helper methods.",
            targetName
        ));

        // Simulate Trivy Software Composition Analysis (SCA)
        log.info("Running Trivy SCA dependency check...");
        report.add(new Vulnerability(
            "Trivy", 
            "MEDIUM", 
            "CVE-2023-4586",
            "Outdated dependency log4j-core has potential remote code execution vulnerability.",
            "pom.xml"
        ));

        // Simulate MobSF Android scanner if target looks like android or apk
        if (targetName.toLowerCase().endsWith(".apk") || targetName.toLowerCase().contains("android")) {
            log.info("Running MobSF APK manifest analyzer...");
            report.add(new Vulnerability(
                "MobSF",
                "CRITICAL",
                "android.permission.RECEIVE_SMS",
                "App requests permission to receive SMS messages, which could leak sensitive 2FA codes.",
                "AndroidManifest.xml"
            ));
        }

        log.info("Consolidated external scanner reports: {} findings compiled.", report.size());
        return report;
    }
}
