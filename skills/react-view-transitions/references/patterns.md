# Patterns and Guidelines

## Searchable Grid with `useDeferredValue`

A client-side searchable grid where the filtered results cross-fade as the user types. `useDeferredValue` makes the filter update a transition, which activates the wrapping `<ViewTransition>`:

```tsx
'use client';

import { useDeferredValue, useState, ViewTransition, Suspense } from 'react';

export default function SearchableGrid({ itemsPromise }) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  return (
    <>
      <input
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        placeholder="Search..."
      />
      <ViewTransition>
        <Suspense fallback={<GridSkeleton />}>
          <ItemGrid itemsPromise={itemsPromise} search={deferredSearch} />
        </Suspense>
      </ViewTransition>
    </>
  );
}
```

## Card Expand/Collapse with `startTransition`

Toggle between a card grid and a detail view using `startTransition` to animate the swap. Add a shared element `name` to morph the card into the detail view:

```tsx
'use client';

import { useState, useRef, startTransition, ViewTransition } from 'react';

export default function ItemGrid({ items }) {
  const [expandedId, setExpandedId] = useState(null);
  const scrollRef = useRef(0);

  return expandedId ? (
    <ViewTransition enter="slide-in" name={`item-${expandedId}`}>
      <ItemDetail
        item={items.find(i => i.id === expandedId)}
        onClose={() => {
          startTransition(() => {
            setExpandedId(null);
            setTimeout(() => window.scrollTo({ behavior: 'smooth', top: scrollRef.current }), 100);
          });
        }}
      />
    </ViewTransition>
  ) : (
    <div className="grid grid-cols-3 gap-4">
      {items.map(item => (
        <ViewTransition key={item.id} name={`item-${item.id}`}>
          <ItemCard
            item={item}
            onSelect={() => {
              scrollRef.current = window.scrollY;
              startTransition(() => setExpandedId(item.id));
            }}
          />
        </ViewTransition>
      ))}
    </div>
  );
}
```

The shared `name={`item-${id}`}` on both the card and detail `<ViewTransition>` creates a shared element pair — the card morphs into the detail view. The `scrollRef` saves and restores scroll position so users return to where they were in the grid. See `css-recipes.md` for the slide-up/slide-down CSS.

## Type-Safe Transition Helpers

For larger apps, define type-safe transition IDs and transition maps to prevent ID clashes and keep animation configurations consistent. Use `as const` arrays for transition IDs, types, and animation classes, then derive types from them:

```tsx
import { ViewTransition } from 'react';

const transitionTypes = ['default', 'transition-to-detail', 'transition-to-list', 'transition-backwards', 'transition-forwards'] as const;
const animationTypes = ['auto', 'none', 'animate-slide-from-left', 'animate-slide-from-right', 'animate-slide-to-left', 'animate-slide-to-right'] as const;

type TransitionType = (typeof transitionTypes)[number];
type AnimationType = (typeof animationTypes)[number];
type TransitionMap = { default: AnimationType } & Partial<Record<Exclude<TransitionType, 'default'>, AnimationType>>;

export function HorizontalTransition({ children, enter, exit }: {
  children: React.ReactNode;
  enter: TransitionMap;
  exit: TransitionMap;
}) {
  return <ViewTransition enter={enter} exit={exit}>{children}</ViewTransition>;
}
```

These wrappers enforce that only valid transition IDs and animation classes are used, catching mistakes at compile time.

## Shared Elements Across Routes in Next.js

See `nextjs.md` (Shared Elements Across Routes) for complete examples using `transitionTypes` on `next/link` combined with shared element `<ViewTransition name={...}>` for list-to-detail image morph animations.

## Isolate Floating Elements from Parent Animations

Popovers, tooltips, and dropdowns can get captured in a parent's view transition snapshot, causing them to ghost or animate unexpectedly. Give them their own `viewTransitionName` to isolate them into a separate transition group:

```jsx
<SelectPopover style={{ viewTransitionName: 'popover' }}>
  {options}
</SelectPopover>
```

```css
::view-transition-group(popover) {
  z-index: 100;
}
```

This creates an independent transition group that renders above other transitioning elements. The element won't be included in its parent's old/new snapshot.

For a global fix that ensures all view transition groups render above normal content, use the wildcard selector:

```css
::view-transition-group(*) {
  z-index: 100;
}
```

## Reusable Animated Collapse

For apps with many expand/collapse interactions, extract a reusable wrapper instead of repeating the conditional-render-with-`<ViewTransition>` pattern:

```jsx
import { ViewTransition } from 'react';

function AnimatedCollapse({ open, children }) {
  if (!open) return null;
  return (
    <ViewTransition enter="expand-in" exit="collapse-out">
      {children}
    </ViewTransition>
  );
}
```

Use it with `startTransition` on the toggle:

```jsx
<button onClick={() => startTransition(() => setOpen(o => !o))}>Toggle</button>
<AnimatedCollapse open={open}>
  <SectionContent />
</AnimatedCollapse>
```

## Preserve State with Activity

Use `<Activity>` with `<ViewTransition>` to animate show/hide while preserving component state:

```jsx
import { Activity, ViewTransition, startTransition } from 'react';

<Activity mode={isVisible ? 'visible' : 'hidden'}>
  <ViewTransition enter="slide-in" exit="slide-out">
    <Sidebar />
  </ViewTransition>
</Activity>
```

## Exclude Elements from a Transition with `useOptimistic`

When a `startTransition` changes both a control (e.g. a button label) and content (e.g. list order), use `useOptimistic` for the control. The optimistic value updates before React's transition snapshot, so it won't animate. The committed state drives the content, which changes within the transition and animates:

```tsx
const [sort, setSort] = useState('newest');
const [optimisticSort, setOptimisticSort] = useOptimistic(sort);

function cycleSort() {
  const nextSort = getNextSort(optimisticSort);
  startTransition(() => {
    setOptimisticSort(nextSort);  // updates before snapshot — no animation
    setSort(nextSort);            // changes within transition — animates
  });
}

// Button uses optimisticSort (instant, excluded from animation)
<button>Sort: {LABELS[optimisticSort]}</button>

// List uses committed sort (changes between snapshots, animates)
{items.sort(comparators[sort]).map(item => (
  <ViewTransition key={item.id}>
    <ItemCard item={item} />
  </ViewTransition>
))}
```

`useOptimistic` values resolve before the transition snapshot. Any DOM driven by optimistic state is already in its final form when the "before" snapshot is taken, so it doesn't participate in the `<ViewTransition>`. Only DOM driven by committed state (via `setState`) changes between snapshots and animates.

---

## Animation Timing Guidelines

Match duration to the interaction type — direct user actions need fast feedback, while ambient reveals can be slower:

| Interaction | Duration | Rationale |
|------------|----------|-----------|
| Direct toggle (expand/collapse, show/hide) | 100–200ms | Responds to a click — must feel instant |
| Route transition (directional slide) | 150–250ms | Brief spatial cue, shouldn't delay navigation |
| Suspense reveal (skeleton → content) | 200–400ms | Soft reveal, content is "arriving" |
| Shared element morph | 300–500ms | Users watch the morph — give it room to breathe |

These are starting points. Test on low-end devices — animations that feel smooth on a fast machine can feel sluggish on mobile.
