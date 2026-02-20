# Monorepo Strategy

This document outlines the current monorepo structure, evaluates tooling options, and provides a recommended migration path for future phases.

## Current State

### Repository Structure

```
grc/
├── backend-nest/     # Canonical NestJS backend (primary)
├── frontend/         # React frontend
├── backend/          # Legacy Express backend (transition)
├── docs/             # Documentation
├── scripts/          # Operational scripts
└── .github/          # CI/CD workflows
```

### Current Tooling

- **Package Manager**: npm (separate package.json per project)
- **Build System**: Individual project builds (nest build, react-scripts build)
- **CI/CD**: GitHub Actions with separate jobs per project
- **Dependency Management**: Independent per project

### Current Challenges

1. **Duplicate Dependencies**: Same packages installed in multiple projects
2. **Version Drift**: Different versions of shared dependencies
3. **No Shared Code**: Cannot easily share utilities between projects
4. **Slow CI**: Each project builds independently
5. **Complex Dependency Updates**: Must update each project separately

## Options Analysis

### Option 1: npm Workspaces

**Overview**: Native npm feature for managing multiple packages in a single repository.

**Pros**:
- No additional tooling required
- Simple setup
- Good npm ecosystem support
- Familiar to most developers

**Cons**:
- Limited build orchestration
- No intelligent caching
- No dependency graph awareness
- Manual task coordination

**Setup Complexity**: Low

**Migration Risk**: Low

**Example Configuration**:
```json
{
  "name": "grc-platform",
  "workspaces": [
    "backend-nest",
    "frontend",
    "backend",
    "packages/*"
  ]
}
```

### Option 2: pnpm Workspaces

**Overview**: Fast, disk-efficient package manager with workspace support.

**Pros**:
- Faster than npm (content-addressable storage)
- Disk space efficient (symlinks)
- Strict dependency resolution
- Good workspace support
- Growing ecosystem adoption

**Cons**:
- Requires team adoption of new tool
- Some packages may have compatibility issues
- Different lockfile format

**Setup Complexity**: Low-Medium

**Migration Risk**: Low-Medium

**Example Configuration**:
```yaml
# pnpm-workspace.yaml
packages:
  - 'backend-nest'
  - 'frontend'
  - 'backend'
  - 'packages/*'
```

### Option 3: Nx

**Overview**: Full-featured monorepo build system with intelligent caching and task orchestration.

**Pros**:
- Intelligent build caching (local and remote)
- Dependency graph awareness
- Affected command (only build/test changed projects)
- Code generators
- Plugin ecosystem (NestJS, React, etc.)
- Excellent documentation

**Cons**:
- Learning curve
- Additional configuration
- Larger tooling footprint
- May be overkill for smaller repos

**Setup Complexity**: Medium-High

**Migration Risk**: Medium

**Example Configuration**:
```json
{
  "projects": {
    "backend-nest": { "root": "backend-nest" },
    "frontend": { "root": "frontend" },
    "backend": { "root": "backend" }
  },
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "lint", "test"]
      }
    }
  }
}
```

### Option 4: Turborepo

**Overview**: High-performance build system for JavaScript/TypeScript monorepos.

**Pros**:
- Very fast (Rust-based)
- Simple configuration
- Remote caching
- Works with existing package managers
- Minimal learning curve

**Cons**:
- Fewer features than Nx
- Smaller plugin ecosystem
- Less mature than Nx

**Setup Complexity**: Low-Medium

**Migration Risk**: Low

**Example Configuration**:
```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {}
  }
}
```

## Comparison Matrix

| Feature | npm Workspaces | pnpm | Nx | Turborepo |
|---------|---------------|------|-----|-----------|
| Setup Complexity | Low | Low-Med | Med-High | Low-Med |
| Migration Risk | Low | Low-Med | Medium | Low |
| Build Caching | No | No | Yes | Yes |
| Remote Caching | No | No | Yes | Yes |
| Affected Commands | No | No | Yes | Yes |
| Code Generators | No | No | Yes | No |
| Learning Curve | Low | Low | Medium | Low |
| Ecosystem | Large | Growing | Large | Growing |

## Recommendation

### Short-Term (FAZ 4-5): No Migration

**Rationale**: The current structure works and migration would introduce risk without immediate benefit. Focus on:

1. Standardizing scripts and tooling
2. Documenting current patterns
3. Improving CI/CD efficiency
4. Establishing shared conventions

### Medium-Term (FAZ 6-7): npm Workspaces

**Rationale**: Lowest risk migration that provides immediate benefits:

1. Shared dependencies at root level
2. Single lockfile
3. Easier dependency updates
4. No new tooling to learn

**Migration Steps**:
1. Create root package.json with workspaces
2. Move shared dependencies to root
3. Update CI to use workspace commands
4. Test thoroughly in staging

### Long-Term (FAZ 8+): Evaluate Nx or Turborepo

**Rationale**: Once the team is comfortable with workspaces, evaluate advanced tooling:

1. Measure CI times and identify bottlenecks
2. Evaluate caching benefits
3. Consider team size and growth
4. Assess need for code generators

**Decision Criteria**:
- CI build time > 15 minutes → Consider caching tools
- Team size > 5 developers → Consider Nx for generators
- Multiple shared packages → Consider Nx for dependency graph

## Migration Roadmap

### Phase 1: Preparation (FAZ 5)

- [ ] Audit all dependencies across projects
- [ ] Identify shared dependencies
- [ ] Document version conflicts
- [ ] Create shared ESLint/Prettier config
- [ ] Standardize TypeScript configuration

### Phase 2: npm Workspaces (FAZ 6)

- [ ] Create root package.json
- [ ] Configure workspaces
- [ ] Hoist shared dependencies
- [ ] Update CI workflows
- [ ] Test all projects
- [ ] Update documentation

### Phase 3: Evaluation (FAZ 7)

- [ ] Measure CI performance
- [ ] Gather team feedback
- [ ] Evaluate Nx/Turborepo benefits
- [ ] Create POC if beneficial
- [ ] Make go/no-go decision

### Phase 4: Advanced Tooling (FAZ 8+)

- [ ] If approved, migrate to Nx/Turborepo
- [ ] Configure remote caching
- [ ] Set up affected commands
- [ ] Train team on new tooling
- [ ] Update CI for new workflow

## Risks and Mitigations

### Risk: Breaking Existing Workflows

**Mitigation**: 
- Migrate incrementally
- Maintain backward compatibility
- Test thoroughly in staging
- Have rollback plan

### Risk: Team Resistance

**Mitigation**:
- Document benefits clearly
- Provide training
- Start with low-risk changes
- Gather feedback early

### Risk: CI/CD Complexity

**Mitigation**:
- Update CI before code changes
- Test CI changes in feature branch
- Keep old workflows as backup
- Monitor build times

## References

- [npm Workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Nx Documentation](https://nx.dev/getting-started/intro)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Monorepo Tools Comparison](https://monorepo.tools/)
