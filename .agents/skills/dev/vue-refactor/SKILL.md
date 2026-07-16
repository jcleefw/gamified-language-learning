---
name: vue-refactor
description: 'Refactors Vue SFC code to follow SRS component patterns: extract logic, split large files, and improve composability while preserving behavior.'
---

# Vue Refactor

When this skill is loaded, follow this sequence to refactor Vue code toward SRS patterns. Do not change behavior — only structure and organization.

## Principles

**Vue is not a single-file blob.** The `<script>`, `<template>`, and `<style scoped>` coexist in one file, but they should be *compositionally clean*:
- Template is a readable tree of components and bindings.
- Script pulls in composables (not inline logic), extracted helpers, and typed props/emits.
- Styles are scoped and organized by BEM or component-local naming.

**Composables are Vue's function extraction.** A composable is a `.ts` file in `src/composables/` that exports a function returning reactive state and methods — equivalent to a React custom hook. Use composables to:
- Share state and logic across components (e.g., `useAuth()`, `useForm()`).
- Extract complex stateful logic from a monolithic component.
- Keep the component's script section under ~100 lines of orchestration code.

**Components are layout + prop flow.** A component's responsibility is:
- Accept props and emit events (explicit contracts).
- Delegate state to composables or parent props.
- Render a readable template tree (nested components, v-if/v-for, event handlers).
- Isolate styles with `<style scoped>`.

## Step 1 — Assess the component

Before refactoring:

- **Is the script section > 150 lines?** Extract composables.
- **Is the template > 100 lines?** Extract sub-components.
- **Does it define helper functions?** Move to `src/utils/` or inline as a composable.
- **Are styles mixed with layout?** Separate into `<style scoped>` with clear naming.
- **Are multiple concerns entangled?** (e.g., quiz logic + audio playback + shelving) → delegate each to a composable.

State of the file:

- Run `wc -l src/components/File.vue` to get line count.
- Read the script section. Count: state refs, composables used, functions defined, computed properties.
- Read the template. Count: v-if/v-for branches, nested component depth, inline logic.

## Step 2 — Extract logic into composables

For each piece of stateful logic in the component:

1. **Identify the boundary.** What state, computed properties, and methods belong together?
   - e.g., in a QuizCard: question rendering is separate from answer-tracking is separate from audio playback.

2. **Create the composable.** In `src/composables/useFeatureName.ts`:
   ```ts
   import { ref, computed } from 'vue'
   
   export function useFeatureName(props?: FeatureProps) {
     const count = ref(0)
     const doubled = computed(() => count.value * 2)
     
     function increment() { count.value++ }
     
     return { count, doubled, increment }
   }
   ```

3. **Replace inline code.** In the component's `<script setup>`:
   ```ts
   const { count, doubled, increment } = useFeatureName()
   ```

4. **Test the composable.** Composables have the same test surface as functions — write a `.test.ts` for it.

## Step 3 — Extract sub-components

If a component's template is > 100 lines or has multiple "sections" with conditional rendering:

1. **Identify boundaries.** Each conditional branch, or each logical section, may be its own component.
   - e.g., HomeDashboard's "Due Review" card is separate from "Practice Anytime" card.

2. **Create the sub-component.** In `src/components/FeatureName.vue`:
   ```vue
   <template>
     <div class="feature"><!-- isolated markup --></div>
   </template>
   
   <script setup lang="ts">
   defineProps<{ /* explicit contract */ }>()
   defineEmits<{ event: [payload] }>()
   </script>
   
   <style scoped>
   .feature { /* isolated styles */ }
   </style>
   ```

3. **Wire into parent.** Import and use the sub-component:
   ```vue
   <Feature :data="data" @action="handleAction" />
   ```

4. **Avoid defineExpose.** If you want to expose internal state, it's usually a sign the child should emit events and let the parent manage state. Use props down, events up.

## Step 4 — Organize styles

Vue's `<style scoped>` is CSS module equivalent — selectors are auto-namespaced.

- Use clear class names: `.card`, `.card-title`, `.card--active` (BEM-like).
- Group related styles together (layout, typography, colors).
- Use CSS variables for theme colors and spacing if the component is reusable.
- Avoid `!important`; if you need it, the specificity is wrong.

Example:

```vue
<style scoped>
.card {
  padding: 16px;
  border-radius: 8px;
  background: white;
}
.card-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 8px;
}
.card--active {
  border-color: #2563eb;
}
</style>
```

## Step 5 — Verify the refactor

- **Tests pass.** Run the test suite. If the component has e2e tests, run those too.
- **Template is readable.** A dev can understand the layout in 30 seconds.
- **Script is orchestration.** The `<script setup>` lists props, composables, and event handlers — no complex logic inline.
- **Composables are reusable.** If a composable is used by only one component, it's OK, but keep them generic enough to extract later.
- **No behavior changed.** Visually and functionally, the component works the same.

## Red flags

- **Long conditional chains in template.** `v-if x / v-else-if y / v-else-if z` → extract branches as sub-components.
- **Composable with `defineExpose`.** Almost always wrong. Use events and props instead.
- **Inline fetch calls or API logic.** Move to a composable. Components don't own I/O.
- **Hard-coded strings, colors, or numbers.** Extract to `src/constants.ts` or component props.
- **Deeply nested templates.** `<div><div><div><component>` is hard to read. Extract the innermost nesting into its own component.

## Rules

- Never change behavior as part of a refactor. If a bug is found, note it separately — do not fix it inline.
- Never refactor and add features in the same pass.
- Red tests mean stop and revert, not push through.
- A composable should export a function that returns an object of state + methods, nothing else. No side effects on import.
- Composables are not class constructors — they have no `this` context and no instance. They're pure functions returning reactive objects.
- If you extract a sub-component, declare its props and emits with `defineProps<{...}>()` and `defineEmits<{...}>()` — no loose prop drilling.
- Prefer named exports from composables; default exports blur intent.
