# Code Map Guide

This document defines the rules for maintaining `CODEMAP.md` files throughout the project.

## Update Rules

Every non-`__tests__` folder owns its own `CODEMAP.md`. Update the **folder-level** CODEMAP, not root, unless the change affects root-level structure or packages.

### When to Update

**ALWAYS update the relevant CODEMAP** when:

- Adding or removing files in a folder
- Changing file purposes or exported APIs
- Modifying entry points or main exports
- Adding a new folder (create a `CODEMAP.md` for it)
- Restructuring dependencies between folders

### Scope Definitions

- **Root `CODEMAP.md`**: Update only when root files, `.agents/` structure, `product-documentation/`, or the packages list change.
- **Folder-level `CODEMAP.md`**: Update when the contents of that specific folder change.
- **`__tests__/` folders**: Excluded from CODEMAP. Integration test files must be self-documenting via a file-level doc comment.

## Maintenance Protocol

Before finishing any code task, check if the folder's CODEMAP needs updating. This is handled by the `code-mapper` skill.
