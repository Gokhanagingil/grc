## Summary
- Add "System" menu item under Admin group linking to /admin/system
- Visibility roles=['admin'] aligned with route guard
- Add GitHub Actions workflow: .github/workflows/frontend-ci.yml

## Acceptance criteria
- Admin role sees menu item and can navigate to /admin/system
- Non-admin does not see menu item; direct URL blocked by ProtectedRoute guard
- Frontend CI runs on PR and is green

