# SQL Query Agent with Manual Safety Check

A natural language to SQL query agent that safely executes database queries with multi-layer safety checks and automatic refinement loops.

## Architecture

### Node Structure

```
User Question
      ↓
[Query Generator Node] ←─────┐ (Refinement Loop)
      ↓                       │
[Safety Check Node] ──────────┤
      ↓ (if safe)             │
[Execution Node]              │
      ↓                       │
[Summary Node]                │
      ↓                       │
   Answer                     │
```

### Components

#### 1. **Query Generator Node** (LLM)
- **Purpose**: Convert natural language questions to SQL
- **Tools**: Schema Extractor (gets table/column info)
- **Output**: Draft SQL query
- **Features**:
  - Schema-aware query generation
  - Handles refinement feedback from safety failures
  - Uses Gemini 1.5 Pro model

#### 2. **Tools Layer**
- **Schema Extractor**: Queries `information_schema` for database structure
- **Safety Checker**: Code-based validation for destructive commands
- **Query Executor**: Safe PostgreSQL query execution with row limits

#### 3. **Safety Check Node**
- **Purpose**: Validate SQL query safety
- **Checks**:
  - Must be SELECT-only (no INSERT/UPDATE/DELETE/DROP)
  - No multi-statement injection (extra semicolons)
  - No SQL comments (can hide malicious code)
  - No dangerous patterns
- **Branching**:
  - ✓ Safe → proceed to Execution
  - ✗ Unsafe → return to Query Generator with feedback

#### 4. **Execution Node**
- **Purpose**: Execute approved SQL queries
- **Features**:
  - Auto-adds LIMIT if missing (default: 100 rows)
  - Returns rows, execution time, and metadata
  - Error handling with PostgreSQL error codes

#### 5. **Summary Node** (LLM)
- **Purpose**: Convert query results to natural language
- **Output**: Human-readable answer to user's question

## Project Structure

```
SQLQueryAgent/
├── lib/
│   ├── agent.js                 # Main orchestration
│   ├── db.js                    # PostgreSQL connection pool
│   ├── nodes/
│   │   ├── llmNodes.js          # Query Generator & Summary nodes
│   │   └── executionNodes.js   # Safety Check & Execution nodes
│   └── tools/
│       ├── schemaExtractor.js   # Database schema tool
│       ├── safetyChecker.js     # SQL safety validation
│       └── queryExecutor.js     # Query execution tool
├── server.js                    # Express API server
├── test-db.js                   # Database connection test
├── .env                         # Environment variables
└── package.json
```

## Installation

1. **Install dependencies**:
```bash
npm install
# or
pnpm install
```

2. **Set up PostgreSQL**:
```sql
CREATE DATABASE query_agent;
CREATE USER agent_user WITH PASSWORD 'agent123';
GRANT ALL PRIVILEGES ON DATABASE query_agent TO agent_user;

\c query_agent
GRANT USAGE ON SCHEMA public TO agent_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO agent_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO agent_user;
```

3. **Configure environment** (`.env`):
```env
PG_HOST=localhost
PG_PORT=5432
PG_DB=query_agent
PG_USER=agent_user
PG_PASS=agent123

GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
```

4. **Start the server**:
```bash
npm run dev
# or
pnpm run dev
```

## API Usage

### POST /ask

Ask a natural language question about your database.

**Request**:
```json
{
  "question": "How many users are in the database?",
  "debug": false,
  "maxRows": 100
}
```

**Response (Success)**:
```json
{
  "success": true,
  "answer": "There are 3 users in the database: Siham, tem, and Fetiya.",
  "query": "SELECT COUNT(*) as user_count FROM users",
  "data": {
    "rows": [{ "user_count": 3 }],
    "rowCount": 1,
    "executionTime": "15ms"
  },
  "metadata": {
    "attempts": 1,
    "warnings": []
  }
}
```

**Response (Safety Failure)**:
```json
{
  "success": false,
  "error": "Could not generate a safe query after multiple attempts",
  "attempts": 3,
  "lastIssues": ["Destructive keyword detected: DROP"],
  "trace": [...]
}
```

### GET /health

Check server status.

**Response**:
```json
{
  "status": "ok",
  "service": "SQL Query Agent"
}
```

## Postman Testing

1. **Create new request**:
   - Method: `POST`
   - URL: `http://localhost:3000/ask`

2. **Headers**:
   - `Content-Type: application/json`

3. **Body** (raw JSON):
```json
{
  "question": "Show me all users",
  "debug": true
}
```

4. **Example Questions**:
   - "How many users are in the database?"
   - "Show me all user emails"
   - "What users were created today?"
   - "List all users ordered by name"

## Safety Features

### Blocked Operations
- ❌ DROP (tables, databases)
- ❌ DELETE (removing data)
- ❌ UPDATE (modifying data)
- ❌ INSERT (adding data)
- ❌ TRUNCATE (clearing tables)
- ❌ ALTER (schema changes)
- ❌ GRANT/REVOKE (permission changes)
- ✅ SELECT (read-only queries)

### Additional Protections
- Multi-statement detection
- SQL comment removal
- Automatic row limits
- Query refinement loop (up to 3 attempts)

## Configuration Options

### Agent Options
```javascript
{
  maxRetries: 3,        // Max query generation attempts
  maxRows: 100,         // Row limit for queries
  debug: false          // Enable trace logging
}
```

### Debug Mode

Enable with `"debug": true` in request to see execution trace:
```json
{
  "trace": [
    { "step": "schema_extraction", "success": true },
    { "step": "query_generation", "attempt": 1, "query": "..." },
    { "step": "safety_check", "safe": true },
    { "step": "execution", "rowCount": 3 },
    { "step": "summarization", "success": true }
  ]
}
```

## Workflow Example

**Question**: "How many users do we have?"

1. **Schema Extraction**: Retrieves `users` table structure
2. **Query Generation** (Attempt 1):
   ```sql
   SELECT COUNT(*) as total_users FROM users
   ```
3. **Safety Check**: ✓ Pass (SELECT-only, no destructive keywords)
4. **Execution**: Returns `[{ "total_users": 3 }]` in 12ms
5. **Summary**: "There are 3 users in the database."

**Result**: User receives natural language answer + SQL query + raw data

## Error Handling

- **Invalid API Key**: Returns 404 with model not found
- **Database Connection**: Connection pool with auto-reconnect
- **SQL Errors**: Returns PostgreSQL error codes and details
- **Unsafe Queries**: Refinement loop with feedback or rejection
- **LLM Failures**: Graceful error messages with trace

## Development

### Test Database Connection
```bash
node test-db.js
```

### Run Server
```bash
npm run dev
```

### Add New Safety Rules
Edit `lib/tools/safetyChecker.js`:
```javascript
const DESTRUCTIVE_KEYWORDS = [
  "DROP", "DELETE", "UPDATE", "YOUR_KEYWORD"
];
```

## License

ISC
"# SqlQuery-Agent" 
