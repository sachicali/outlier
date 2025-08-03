# Global Slash Commands  
*YouTube Outlier Discovery Tool*

This document defines the global slash commands available for the YouTube Outlier Discovery Tool. Commands are grouped by category for clarity. Each entry includes the command name, description, usage example, and the action performed.

---

## Memory & Context

### `/memory-update`
**Description:** Update all Memory Bank files to reflect the latest project state.  
**Usage:** `/memory-update`  
**Action:** Triggers a review and update of all files in `memory-bank/`, ensuring documentation and context are current.

### `/memory-read`
**Description:** Read and summarize the current Memory Bank context.  
**Usage:** `/memory-read`  
**Action:** Outputs a summary of all core Memory Bank files for situational awareness.

### `/context-refresh`
**Description:** Reload and synchronize project context from Memory Bank and .clinerules.  
**Usage:** `/context-refresh`  
**Action:** Ensures all tools and contributors are working with the latest context.

### `/context-diff`
**Description:** Show differences between current and previous Memory Bank states.  
**Usage:** `/context-diff`  
**Action:** Displays changes in context, highlighting recent updates.

### `/active-context`
**Description:** Display the current focus, recent changes, and next steps.  
**Usage:** `/active-context`  
**Action:** Outputs the contents of `memory-bank/activeContext.md`.

---

## Development

### `/dev-start`
**Description:** Begin a new development session, initializing context and todos.  
**Usage:** `/dev-start`  
**Action:** Sets up a new session, loads context, and prompts for a todo list.

### `/dev-stop`
**Description:** End the current development session and summarize progress.  
**Usage:** `/dev-stop`  
**Action:** Finalizes the session, updates progress, and archives session notes.

### `/todo-list`
**Description:** Display or update the current development todo list.  
**Usage:** `/todo-list`  
**Action:** Shows or modifies the active checklist for ongoing work.

### `/code-search`
**Description:** Search codebase for a pattern or keyword.  
**Usage:** `/code-search outlierDetection`  
**Action:** Performs a regex or keyword search across the project.

### `/code-refactor`
**Description:** Initiate a code refactor for a specified module or file.  
**Usage:** `/code-refactor server/src/services/outlierDetectionService.js`  
**Action:** Begins a guided refactor process for the target code.

---

## Quality & Testing

### `/test-run`
**Description:** Run all unit and integration tests.  
**Usage:** `/test-run`  
**Action:** Executes the full test suite and reports results.

### `/test-coverage`
**Description:** Generate and display code coverage report.  
**Usage:** `/test-coverage`  
**Action:** Runs coverage tools and outputs a summary.

### `/lint`
**Description:** Run code linter on the project or a specific file.  
**Usage:** `/lint client/components/YouTubeOutlierApp.tsx`  
**Action:** Checks code style and highlights issues.

### `/mock-api`
**Description:** Enable or configure API mocking for tests.  
**Usage:** `/mock-api enable`  
**Action:** Activates mock services for deterministic testing.

### `/quality-report`
**Description:** Generate a quality summary for the current codebase.  
**Usage:** `/quality-report`  
**Action:** Outputs a report on code quality, test status, and known issues.

---

## Infrastructure & Deployment

### `/infra-status`
**Description:** Show current infrastructure and service status.  
**Usage:** `/infra-status`  
**Action:** Displays health and availability of backend, frontend, and Redis.

### `/deploy`
**Description:** Deploy the latest build to the target environment.  
**Usage:** `/deploy staging`  
**Action:** Initiates deployment to the specified environment.

### `/env-vars`
**Description:** List or update environment variables.  
**Usage:** `/env-vars list`  
**Action:** Shows or modifies environment variable settings.

### `/db-migrate`
**Description:** Run database migrations.  
**Usage:** `/db-migrate`  
**Action:** Applies pending migrations to the database.

### `/health-check`
**Description:** Perform a health check on all core services.  
**Usage:** `/health-check`  
**Action:** Runs health checks and reports status.

---

## Security

### `/security-scan`
**Description:** Run a security scan on the codebase and dependencies.  
**Usage:** `/security-scan`  
**Action:** Checks for vulnerabilities and outputs a report.

### `/audit-log`
**Description:** Display recent security-related events and actions.  
**Usage:** `/audit-log`  
**Action:** Shows the latest entries from the audit log.

### `/rate-limit-status`
**Description:** Show current API rate limit and quota usage.  
**Usage:** `/rate-limit-status`  
**Action:** Displays YouTube API quota and usage statistics.

### `/auth-status`
**Description:** Display authentication and authorization configuration.  
**Usage:** `/auth-status`  
**Action:** Shows current auth settings and user roles.

---

## Analytics

### `/analysis-run`
**Description:** Start a new YouTube outlier analysis.  
**Usage:** `/analysis-run`  
**Action:** Initiates the outlier detection pipeline.

### `/analysis-progress`
**Description:** Show real-time progress of the current analysis.  
**Usage:** `/analysis-progress`  
**Action:** Displays progress stages and estimated time remaining.

### `/analysis-history`
**Description:** List previous analyses and results.  
**Usage:** `/analysis-history`  
**Action:** Outputs a history of past analyses.

### `/brand-score`
**Description:** Run or display brand compatibility scoring.  
**Usage:** `/brand-score`  
**Action:** Executes or shows the latest brand compatibility results.

---

## Management & Documentation

### `/doc-update`
**Description:** Update project documentation from the latest context.  
**Usage:** `/doc-update`  
**Action:** Refreshes all docs, including README and Memory Bank.

### `/changelog`
**Description:** Show or append to the project changelog.  
**Usage:** `/changelog add "Improved outlier detection thresholds"`  
**Action:** Displays or updates `CHANGELOG.md` using FAB format.

### `/rules`
**Description:** Display or update project rules and conventions.  
**Usage:** `/rules`  
**Action:** Shows `.clinerules` content or prompts for updates.

### `/pattern-log`
**Description:** Show system patterns and architecture decisions.  
**Usage:** `/pattern-log`  
**Action:** Outputs `memory-bank/systemPatterns.md` content.

### `/help`
**Description:** List all available slash commands and their usage.  
**Usage:** `/help`  
**Action:** Displays this command reference.

---

## Debug & Support

### `/debug`
**Description:** Enter debug mode for troubleshooting.  
**Usage:** `/debug`  
**Action:** Enables verbose logging and diagnostic tools.

### `/log-tail`
**Description:** Show the latest application logs.  
**Usage:** `/log-tail`  
**Action:** Outputs recent log entries from backend and frontend.

### `/socket-status`
**Description:** Display current Socket.IO connection status.  
**Usage:** `/socket-status`  
**Action:** Shows real-time WebSocket connection info.

### `/reset-session`
**Description:** Reset the current user or analysis session.  
**Usage:** `/reset-session`  
**Action:** Clears session state and restarts context.

---

*For more details on workflows and architecture, see the Memory Bank and `.clinerules`.*
