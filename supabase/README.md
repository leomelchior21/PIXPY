# Supabase setup

1. Open the project's SQL editor.
2. Run `migrations/202608310001_pixpy_core.sql`.
3. Generate the local roster seed:

   ```powershell
   python scripts/generate_roster_seed.py "Turmas JK - AF e EM - 2026.08.25.pdf"
   ```

4. Review `supabase/roster.seed.local.sql`, then run it in the same SQL editor.

The generated seed is intentionally ignored by Git. It contains only the derived access ID (`first name + final last name`, lowercase and normalized), a safe ranking label (`First L.`), and the class grouping. It never copies roster number, RA, or email.

Direct table access is denied to browser roles. Student identification and saving happen through narrow `security definer` RPCs with expiring session tokens. The name-based classroom ID remains a convenience identifier, not strong authentication; add a teacher-issued PIN later if impersonation becomes a classroom problem.
