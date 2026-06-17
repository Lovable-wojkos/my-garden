# E2E Testing Rules

- Use `getByRole`, `getByLabel`, and `getByText` as primary locators.
- Never use CSS selectors or XPath for user-facing interactions.
- Keep tests independently runnable with their own setup and cleanup.
- Never use `page.waitForTimeout()`. Wait for state with web-first assertions.
- Assert business outcomes tied to the protected risk.
- Use unique test data to avoid collisions in parallel runs.
- Use `storageState` for authentication in test projects.
