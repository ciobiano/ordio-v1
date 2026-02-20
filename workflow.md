Your First Session Workflow:

Agent reads documentation (30 seconds)
Agent proposes plan for Phase 1 setup
You review and approve (or request changes)
Agent implements incrementally:

Set up monorepo
Create packages/shared
Implement time conversion functions
Write unit tests
Set up pre-commit hooks


Verify together:

bash   pnpm test
   pnpm lint
   pnpm type-check
```
6. **Commit when all checks pass**
7. **Update AGENTS.md** with progress

---

## Success Checklist:

Your setup is complete when:
- [✓] All files saved in correct locations
- [✓] Project folder created
- [✓] AI tool opened and ready
- [✓] First prompt ready to send

---

## 💡 Pro Tips:

### For Claude Code:
- Use the `@file` syntax to reference specific files
- Ask Claude to run commands directly: "Run `pnpm test` and show me the results"
- Use sessions to maintain context across days

### For Cursor:
- Use `Cmd+K` (Mac) or `Ctrl+K` (Windows) for inline edits
- Reference files with `@filename` in chat
- Use Cursor's composer mode for multi-file changes

### For Antigravity:
- Leverage parallel agents for exploration
- Use plan mode for complex features
- Ask for architecture diagrams when needed

---

## Troubleshooting:

**If AI seems confused:**
```
First, read AGENTS.md completely and confirm you understand:
1. The core value prop (preview-export parity)
2. The current phase (Phase 1: Foundation)
3. The critical constraints (SSIM ≥0.98, <$50/mo budget)
Then proceed.
```

**If AI skips verification:**
```
STOP. Before proceeding, run these commands and fix all failures:
pnpm lint
pnpm type-check
pnpm test
```

**If AI suggests wrong approach:**
```
That violates our architectural constraints. Review agent_docs/code_patterns.md section on [specific topic]. The correct approach is [explain].
```

**If you get stuck:**
```
Let's break this down into smaller steps. What's the absolute minimum working version of this feature? Let's implement that first, verify it works, then iterate.
