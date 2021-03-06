package com.thinkbiganalytics.spark.repl;

/*-
 * #%L
 * thinkbig-commons-spark-repl
 * %%
 * Copyright (C) 2017 ThinkBig Analytics
 * %%
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * #L%
 */

import com.google.common.base.Joiner;
import com.thinkbiganalytics.spark.SparkInterpreterBuilder;

import org.apache.commons.io.IOUtils;
import org.apache.spark.SparkConf;
import org.apache.spark.SparkContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLClassLoader;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import javax.annotation.Nonnull;
import javax.annotation.Nullable;
import javax.script.ScriptException;

import scala.collection.JavaConversions;
import scala.tools.nsc.Settings;
import scala.tools.nsc.interpreter.IMain;
import scala.tools.nsc.interpreter.Results;

/**
 * Evaluates Scala scripts using the Spark REPL interface.
 */
@Component
@ComponentScan("com.thinkbiganalytics.spark")
public class SparkScriptEngine extends ScriptEngine {

    private static final Logger log = LoggerFactory.getLogger(SparkScriptEngine.class);

    /**
     * Spark configuration
     */
    @Autowired
    private SparkConf conf;

    /**
     * List of patterns to deny in scripts
     */
    @Nullable
    private List<Pattern> denyPatterns;

    /**
     * Spark REPL interface
     */
    @Nullable
    private IMain interpreter;

    @Autowired
    private SparkInterpreterBuilder builder;

    @Nonnull
    @Override
    protected SparkContext createSparkContext() {
        // Let Spark know where to find class files
        getInterpreter();

        // The SparkContext ClassLoader is needed during initialization (only for YARN master)
        Thread currentThread = Thread.currentThread();
        ClassLoader contextClassLoader = currentThread.getContextClassLoader();
        currentThread.setContextClassLoader(SparkContext.class.getClassLoader());

        log.info("Creating spark context with spark conf {}", conf);

        SparkContext sparkContext = new SparkContext(this.conf);
        currentThread.setContextClassLoader(contextClassLoader);
        return sparkContext;
    }

    @Override
    protected void execute(@Nonnull final String script) throws ScriptException {
        log.debug("Executing script:\n{}", script);

        for (final Pattern pattern : getDenyPatterns()) {
            if (pattern.matcher(script).find()) {
                log.error("Not executing script that matches deny pattern: {}", pattern.toString());
                throw new ScriptException("Script not executed due to security policy.");
            }
        }

        try {
            getInterpreter().interpret(script);
        } catch (final AssertionError e) {
            log.warn("Caught assertion error when executing script. Retrying...", e);
            reset();
            getInterpreter().interpret(script);
        }
    }

    @Override
    protected void reset() {
        super.reset();

        // Clear the interpreter
        if (interpreter != null) {
            interpreter.close();
            interpreter = null;
        }
    }

    /**
     * Gets the list of patterns that should prevent a script from executing.
     *
     * @return the deny patterns list
     * @throws IllegalStateException if the spark-deny-patterns.conf file cannot be found
     */
    @Nonnull
    private List<Pattern> getDenyPatterns() {
        if (denyPatterns == null) {
            // Load deny patterns
            final List<String> denyPatternLines;
            try {
                denyPatternLines = IOUtils.readLines(getClass().getResourceAsStream("/spark-deny-patterns.conf"), "UTF-8");
            } catch (final IOException e) {
                throw new IllegalStateException("Unable to load spark-deny-patterns.conf", e);
            }

            // Compile patterns
            denyPatterns = new ArrayList<>();
            for (final String line : denyPatternLines) {
                final String trimLine = line.trim();
                if (!line.startsWith("#") && !trimLine.isEmpty()) {
                    denyPatterns.add(Pattern.compile(line));
                }
            }
        }
        return denyPatterns;
    }

    /**
     * Gets the Spark REPL interface to be used.
     *
     * @return the interpreter
     */
    @Nonnull
    private IMain getInterpreter() {
        if (this.interpreter == null) {
            // Determine engine settings
            Settings settings = getSettings();

            // Initialize engine
            final ClassLoader parentClassLoader = getClass().getClassLoader();
            SparkInterpreterBuilder b = this.builder.withSettings(settings);
            b = b.withPrintWriter(getPrintWriter());
            b = b.withClassLoader(parentClassLoader);
            IMain interpreter = b.newInstance();

            interpreter.setContextClassLoader();
            interpreter.initializeSynchronous();

            // Setup environment
            scala.collection.immutable.List<String> empty = JavaConversions.asScalaBuffer(new ArrayList<String>()).toList();
            Results.Result result = interpreter.bind("engine", SparkScriptEngine.class.getName(), this, empty);
            if (result instanceof Results.Error$) {
                throw new IllegalStateException("Failed to initialize interpreter");
            }

            this.interpreter = interpreter;
        }
        return this.interpreter;
    }

    private Settings getSettings() {
        Settings settings = new Settings();

        if (settings.classpath().isDefault()) {
            String classPath = Joiner.on(':').join(((URLClassLoader) getClass().getClassLoader()).getURLs()) + ":" + System
                .getProperty("java.class.path");
            settings.classpath().value_$eq(classPath);
        }
        return settings;
    }
}
