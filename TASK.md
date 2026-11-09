# Task Tracking: Fix Active Semester Selection Error

- [x] Investigate root cause of `Error setting active semester` on Admin Dashboard
- [x] Identify underlying PostgreSQL `safeupdate` error (`code: 21000: UPDATE requires a WHERE clause`)
- [x] Formulate solution options and write implementation plan artifact
- [x] Obtain user approval (User selected Option A: local fix first, verify locally before push)
- [x] Implement Option A in `src/lib/actions/admin/semesterActions.ts` (direct safe updates with explicit WHERE clauses)
- [x] Add unit tests in `src/__tests__/semesterActions.test.ts`
- [x] Run test suite (`npm test`) locally and verify (all 19 tests pass)
- [x] Verify build locally (`npm run build` - successful)
- [x] User review and approval to push to git
- [x] Push changes to remote repository
