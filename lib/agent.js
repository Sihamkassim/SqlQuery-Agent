import { extractSchema } from "./tools/schemaExtractor.js";
import { generateQuery, summarizeResults } from "./nodes/llmNodes.js";
import { safetyCheckNode, executionNode } from "./nodes/executionNodes.js";

/**
 * SQL Query Agent
 * Main orchestration with refinement loop
 */
export async function sqlQueryAgent(question, options = {}) {
  const {
    maxRetries = 3,
    maxRows = 100,
    debug = false,
  } = options;

  const trace = [];
  let attempt = 0;
  let previousQuery = null;
  let safetyFeedback = null;

  try {
    // Step 1: Extract database schema
    if (debug) console.log("Step 1: Extracting schema...");
    const schema = await extractSchema();
    trace.push({ step: "schema_extraction", success: true });

    // Step 2-4: Query generation with safety loop
    let safeQuery = null;
    let safetyResult = null;

    while (attempt < maxRetries) {
      attempt++;
      if (debug) console.log(`\nAttempt ${attempt}: Generating query...`);

      // Step 2: Generate SQL query
      const queryGenResult = await generateQuery(
        question,
        schema,
        previousQuery,
        safetyFeedback
      );

      if (!queryGenResult.success) {
        trace.push({
          step: "query_generation",
          attempt,
          success: false,
          error: queryGenResult.error,
        });
        return {
          success: false,
          error: "Failed to generate SQL query",
          details: queryGenResult.error,
          trace,
        };
      }

      const generatedQuery = queryGenResult.query;
      if (debug) console.log("Generated query:", generatedQuery);

      trace.push({
        step: "query_generation",
        attempt,
        success: true,
        query: generatedQuery,
      });

      // Step 3: Safety check
      if (debug) console.log("Checking safety...");
      safetyResult = await safetyCheckNode(generatedQuery);

      trace.push({
        step: "safety_check",
        attempt,
        safe: safetyResult.safe,
        issues: safetyResult.issues,
        warnings: safetyResult.warnings,
      });

      if (safetyResult.safe) {
        safeQuery = generatedQuery;
        if (debug) console.log("✓ Query is safe!");
        break;
      } else {
        if (debug) console.log("✗ Query failed safety check:", safetyResult.issues);
        previousQuery = generatedQuery;
        safetyFeedback = safetyResult.issues.join("; ");
      }
    }

    // If no safe query after max retries
    if (!safeQuery) {
      return {
        success: false,
        error: "Could not generate a safe query after multiple attempts",
        attempts: attempt,
        lastIssues: safetyResult.issues,
        trace,
      };
    }

    // Step 5: Execute query
    if (debug) console.log("\nExecuting query...");
    const executionResult = await executionNode(safeQuery, maxRows);

    trace.push({
      step: "execution",
      success: executionResult.success,
      rowCount: executionResult.data?.rowCount,
      executionTime: executionResult.data?.executionTime,
    });

    if (!executionResult.success) {
      return {
        success: false,
        error: "Query execution failed",
        details: executionResult.error,
        query: safeQuery,
        trace,
      };
    }

    if (debug) console.log(`✓ Query executed: ${executionResult.data.rowCount} rows`);

    // Step 6: Summarize results
    if (debug) console.log("\nGenerating summary...");
    const summaryResult = await summarizeResults(
      question,
      executionResult.data,
      safeQuery
    );

    trace.push({
      step: "summarization",
      success: summaryResult.success,
    });

    if (!summaryResult.success) {
      return {
        success: false,
        error: "Failed to generate summary",
        details: summaryResult.error,
        query: safeQuery,
        data: executionResult.data,
        trace,
      };
    }

    // Success!
    return {
      success: true,
      answer: summaryResult.summary,
      query: safeQuery,
      data: {
        rows: executionResult.data.rows,
        rowCount: executionResult.data.rowCount,
        executionTime: executionResult.data.executionTime,
      },
      metadata: {
        attempts: attempt,
        warnings: safetyResult.warnings,
      },
      trace: debug ? trace : undefined,
    };

  } catch (error) {
    trace.push({
      step: "error",
      error: error.message,
    });

    return {
      success: false,
      error: "Unexpected error in agent execution",
      details: error.message,
      trace,
    };
  }
}
