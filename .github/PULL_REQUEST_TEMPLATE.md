## What does this PR do?

Briefly describe what you changed and why. Focus on the "what" and "why", not the "how".

## Acceptance Criteria

Write at least one scenario using **Given / When / Then**. This helps reviewers and testers understand what "done" looks like.

```
Given  user is logged in as an assessor
When   user opens the assessment list page
Then   user can see all assessments that have been created

Given  user clicks "Invite Candidate"
When   modal opens, user enters a name, clicks "Create Link"
Then   a new session is created and invite link is shown with copy button
```

## Implementation approach

Explain your technical approach. Keep it short — reviewers use this to understand your thinking before reading the code.

- **Files changed**: list the main files
- **Approach**: which pattern you used and why
- **Trade-offs**: what else did you consider
- **Impact**: API changes, DB migration, new env vars, etc.

```
Examples:
- Added server-side validation for assessment name (assessment_controller.rb)
- Updated TypeScript interfaces to match API response (types/index.ts)
- Used ActiveRecord validation instead of JS-only — keeps data consistent
- No migration, no new env vars
```

## Notes (optional)

Anything else the reviewer should know? E.g. "this depends on PR #42", "still has a FIXME on line 15", "only covers the first scenario for now".
