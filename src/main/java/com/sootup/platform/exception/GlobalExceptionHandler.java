package com.sootup.platform.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.*;

@ControllerAdvice
public class GlobalExceptionHandler {

    public static class ErrorEnvelope {
        private String error;
        private String message;
        private List<String> details;

        public ErrorEnvelope(String error, String message, List<String> details) {
            this.error = error;
            this.message = message;
            this.details = details;
        }

        public String getError() {
            return error;
        }

        public String getMessage() {
            return message;
        }

        public List<String> getDetails() {
            return details;
        }
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorEnvelope> handleValidationExceptions(MethodArgumentNotValidException ex) {
        List<String> details = new ArrayList<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            details.add(error.getField() + ": " + error.getDefaultMessage());
        }
        ErrorEnvelope envelope = new ErrorEnvelope("Bad Request", "Validation failed", details);
        return new ResponseEntity<>(envelope, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorEnvelope> handleIllegalArgumentException(IllegalArgumentException ex) {
        ErrorEnvelope envelope = new ErrorEnvelope("Bad Request", ex.getMessage(), Collections.emptyList());
        return new ResponseEntity<>(envelope, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<ErrorEnvelope> handleNoSuchElementException(NoSuchElementException ex) {
        ErrorEnvelope envelope = new ErrorEnvelope("Not Found", ex.getMessage(), Collections.emptyList());
        return new ResponseEntity<>(envelope, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorEnvelope> handleAllExceptions(Exception ex) {
        ErrorEnvelope envelope = new ErrorEnvelope("Internal Server Error", ex.getMessage(), Collections.emptyList());
        return new ResponseEntity<>(envelope, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
