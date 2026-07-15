# srs-demo rules

## Environment & Config

- Read build/runtime env flags only from `src/env.ts` (the central `env` object) — never inline `import.meta.env.*` in components or composables.
- Keep debug/dump/test-only code out of normal feature functions, even when it's correctly flag-gated: extract it into its own named unit (function/composable) rather than inlining it into a happy-path function like a nav handler or submit handler. This keeps the feature's control flow readable at a glance, and lets the unit's own gate (`env.testHooks` for test-run hooks, `env.debugMode` for manual-run debug aids) fully dead-code-eliminate it in production builds — a flag check spliced into the middle of a feature function doesn't get eliminated even if it's always false at runtime.

## Vue Component Structure

### Script Section

- Keep component script sections under **150 lines**. If a script exceeds this:
  - Extract composables for stateful logic (state refs, computed properties, lifecycle methods).
  - Extract helper functions to `src/utils/` if they're pure utilities.
  - Extract event handlers to composables if they're complex or shared.
  - A script section should read as orchestration: prop/composable declarations, computed derivations, event delegation — not implementation details.

- **No `defineExpose`** unless integrating with third-party libraries that require it. If the urge arises, ask: should the child emit an event instead? Should the parent own the state? Should this be a store (Pinia)?

- **Use composables for shared logic.** A composable is a `.ts` file in `src/composables/useFeatureName.ts` that exports a function returning reactive state and methods. Composables are Vue's equivalent of React custom hooks.

  ```ts
  // src/composables/useCardState.ts
  import { ref, computed } from 'vue';
  export function useCardState() {
    const score = ref(0);
    const doubled = computed(() => score.value * 2);
    return { score, doubled };
  }

  // In component
  const { score, doubled } = useCardState();
  ```

- **Props and emits must be explicit.** Declare with `defineProps<{...}>()` and `defineEmits<{...}>()` (typed, not strings). Avoid prop drilling across 3+ component layers — if you find yourself passing props through multiple intermediaries, that's state that belongs in a composable or store.

### Template Section

- Keep templates **readable at a glance.** If a template exceeds ~100 lines, extract sub-components.
  - Each `v-if/v-else-if` branch that spans >10 lines becomes its own component.
  - Each distinct "card" or "section" with its own styling becomes its own component.
  - This is not over-engineering — a readable template is as important as readable code.

- **v-if > v-show** for conditional rendering unless performance (many toggles) demands v-show. v-if removes the DOM node; v-show toggles visibility. In learning/quiz contexts, use v-if for screen transitions.

- **No inline logic in templates.** Complex expressions go in `computed()` or methods. This reads as a rule but is really a readability aid:

  ```vue
  <!-- Bad: hard to read -->
  <div v-if="currentQuestion && currentQuestion.kind === 'word-block' && appDecks.some(d => d.id === currentQuestion.deckId)">

  <!-- Good: clear intent -->
  <div v-if="showAudioControl">
  ```

  Then in script:

  ```ts
  const showAudioControl = computed(
    () => currentQuestion.value?.kind === 'word-block' && deckHasAudio.value,
  );
  ```

### Style Section

- **Always use `<style scoped>`** — Vue auto-namespaces selectors to the component. Never use bare global styles from a component (use `src/global.css` for app-wide resets only).

- **Keep styles near markup.** If a style is only used by this component, it lives in the component's `<style scoped>` block. If it's shared, extract to a utility CSS class in `src/global.css` and reference it from templates.

- **Use clear, descriptive class names.** BEM-like naming (`card`, `card-title`, `card--active`) is clearer than utility classes alone. Tailwind-style utilities are OK for layout (flexbox, spacing) but not for semantic styling (colors, typography) unique to this component.

## File Organization

- **Components:** `src/components/` — UI components that render.
- **Composables:** `src/composables/` — stateful logic (functions returning reactive state + methods).
- **Utils:** `src/utils/` — pure functions (no state, no Vue imports).
- **Types:** `src/types.ts` — shared TypeScript types.
- **Stores:** `src/stores/` — if Pinia is needed (currently not; state is in composables).

## Imports & Dependencies

- Prefer `import { ... } from 'vue'` for reactive primitives (ref, computed, watch, onMounted).
- Composables export named functions, never default exports.

  ```ts
  // Good
  export function useFeature() { ... }

  // Avoid
  export default function useFeature() { ... }
  ```

- No circular imports. If component A needs logic from component B and vice versa, extract to a composable.

## Testing

- Components with complex logic should have `.test.ts` files. Test the composable separately from the component render.
- e2e tests are in `e2e/` and target user flows (navigation, quiz answering, review sessions).

## Performance

- Use `computed()` to derive values, not methods that recompute every render.
- Use `watch()` to react to state changes, not `onMounted` + imperative mutations.
- Avoid `watch()` with deep: true unless you truly need it. Usually you can watch a computed property instead.
- For lists, always provide a `:key` prop on `v-for` — use the item's ID, not the index.
