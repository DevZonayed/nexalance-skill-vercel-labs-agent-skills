---
name: react-view-transition
description: Guide for implementing smooth, native-feeling animations using React's View Transition API (`<ViewTransition>` component, `addTransitionType`, and CSS view transition pseudo-elements). Use this skill whenever the user wants to add page transitions, animate route changes, create shared element animations, animate enter/exit of components, animate list reorder, implement directional (forward/back) navigation animations, or integrate view transitions in Next.js. Also use when the user mentions view transitions, `startViewTransition`, `ViewTransition`, transition types, or asks about animating between UI states in React without third-party animation libraries.
---

# React View Transitions

React's View Transition API lets you animate between UI states using the browser's native `document.startViewTransition` under the hood. React manages the lifecycle automatically — you declare *what* to animate with `<ViewTransition>`, trigger *when* to animate through `startTransition` / `useDeferredValue` / `Suspense`, and control *how* to animate with CSS classes or JavaScript via the Web Animations API.

The API adds ~3KB to your bundle, runs on the browser's compositor thread for 60fps animations, and gracefully falls back to instant state changes in unsupported browsers.

## Availability

- `<ViewTransition>` and `addTransitionType` shipped in **React 19.2** (stable).
- For older React 19 versions, both are available in `react@canary` and `react@experimental`.
- Browser support: Chromium-based browsers have full support. Firefox and Safari are adding support. The API gracefully degrades — unsupported browsers skip the animation and apply the DOM change instantly.

---

## Core Concepts

### The `<ViewTransition>` Component

Wrap the elements you want to animate:

```jsx
import { ViewTransition } from 'react';

<ViewTransition>
  <Component />
</ViewTransition>
```

React automatically assigns a unique `view-transition-name` to the nearest DOM node inside each `<ViewTransition>`, and calls `document.startViewTransition` behind the scenes. Never call `startViewTransition` yourself — React coordinates all view transitions and will interrupt external ones.

### Animation Triggers

React decides which type of animation to run based on what changed:

| Trigger | When it fires |
|---------|--------------|
| **enter** | A `<ViewTransition>` is first inserted during a Transition |
| **exit** | A `<ViewTransition>` is first removed during a Transition |
| **update** | DOM mutations happen inside a `<ViewTransition>`, or the boundary changes size/position due to an immediate sibling |
| **share** | A named `<ViewTransition>` unmounts and another with the same `name` mounts in the same Transition (shared element transition) |

Only updates wrapped in `startTransition`, `useDeferredValue`, or `Suspense` activate `<ViewTransition>`. Regular `setState` updates immediately and does not animate.

### Critical Placement Rule

`<ViewTransition>` only activates enter/exit if it appears **before any DOM nodes** in the component tree:

```jsx
// Works — ViewTransition is before the DOM node
function Item() {
  return (
    <ViewTransition enter="auto" exit="auto">
      <div>Content</div>
    </ViewTransition>
  );
}

// Broken — a <div> wraps the ViewTransition, preventing enter/exit
function Item() {
  return (
    <div>
      <ViewTransition enter="auto" exit="auto">
        <div>Content</div>
      </ViewTransition>
    </div>
  );
}
```

---

## Styling Animations with View Transition Classes

Rather than using `view-transition-name` in CSS directly, React recommends providing a **View Transition Class** to the activation props. React applies this class to the child elements when the animation activates.

### Props

Each prop controls a different trigger. Values can be:

- `"auto"` — use the browser default cross-fade
- `"none"` — disable this animation type
- `"my-class-name"` — a custom CSS class
- An object `{ [transitionType]: value }` for type-specific animations (see Transition Types below)

```jsx
<ViewTransition
  default="none"          // disable everything not explicitly listed
  enter="slide-in"        // CSS class for enter animations
  exit="slide-out"        // CSS class for exit animations
  update="cross-fade"     // CSS class for update animations
  share="morph"           // CSS class for shared element animations
/>
```

If `default` is `"none"`, all triggers are off unless explicitly listed.

### Defining CSS Animations

Use the view transition pseudo-element selectors with the class name:

```css
::view-transition-old(.slide-in) {
  animation: 300ms ease-out slide-out-to-left;
}
::view-transition-new(.slide-in) {
  animation: 300ms ease-out slide-in-from-right;
}

@keyframes slide-out-to-left {
  to { transform: translateX(-100%); opacity: 0; }
}
@keyframes slide-in-from-right {
  from { transform: translateX(100%); opacity: 0; }
}
```

The pseudo-elements available are:

- `::view-transition-group(.class)` — the container for the transition
- `::view-transition-image-pair(.class)` — contains old and new snapshots
- `::view-transition-old(.class)` — the outgoing snapshot
- `::view-transition-new(.class)` — the incoming snapshot

---

## Transition Types with `addTransitionType`

`addTransitionType` lets you tag a transition with a string label so `<ViewTransition>` can pick different animations based on *what caused* the change. This is essential for directional navigation (forward vs. back) or distinguishing user actions (click vs. swipe vs. keyboard).

### Basic Usage

```jsx
import { startTransition, addTransitionType } from 'react';

function navigate(url, direction) {
  startTransition(() => {
    addTransitionType(`navigation-${direction}`); // "navigation-forward" or "navigation-back"
    setCurrentPage(url);
  });
}
```

You can add multiple types to a single transition, and if multiple transitions are batched, all types are collected.

### Using Types with View Transition Classes

Pass an object instead of a string to any activation prop. Keys are transition type strings, values are CSS class names:

```jsx
<ViewTransition
  enter={{
    'navigation-forward': 'slide-in-from-right',
    'navigation-back': 'slide-in-from-left',
    default: 'fade-in',
  }}
  exit={{
    'navigation-forward': 'slide-out-to-left',
    'navigation-back': 'slide-out-to-right',
    default: 'fade-out',
  }}
>
  <Page />
</ViewTransition>
```

The `default` key inside the object is the fallback when no type matches. If any type has the value `"none"`, the ViewTransition is disabled for that trigger.

### Using Types with CSS `:active-view-transition-type()`

React also adds all transition types as browser view transition types, enabling pure CSS scoping:

```css
:root:active-view-transition-type(navigation-forward) {
  &::view-transition-old(*) {
    animation: 300ms ease-out slide-out-to-left;
  }
  &::view-transition-new(*) {
    animation: 300ms ease-out slide-in-from-right;
  }
}
```

### Using Types with View Transition Events

The `types` array is also available in event callbacks:

```jsx
<ViewTransition
  onEnter={(instance, types) => {
    const duration = types.includes('fast') ? 150 : 500;
    const anim = instance.new.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration, easing: 'ease-out' }
    );
    return () => anim.cancel();
  }}
>
```

---

## Shared Element Transitions

Assign the same `name` to two `<ViewTransition>` components — one in the unmounting tree and one in the mounting tree — to animate between them as if they're the same element:

```jsx
const HERO_IMAGE = 'hero-image';

function ListView({ onSelect }) {
  return (
    <ViewTransition name={HERO_IMAGE}>
      <img src="/thumb.jpg" onClick={() => startTransition(() => onSelect())} />
    </ViewTransition>
  );
}

function DetailView() {
  return (
    <ViewTransition name={HERO_IMAGE}>
      <img src="/full.jpg" />
    </ViewTransition>
  );
}
```

Rules for shared element transitions:
- Only one `<ViewTransition>` with a given `name` can be mounted at a time — use globally unique names (namespace with a prefix or module constant).
- The "share" trigger takes precedence over "enter"/"exit".
- If either side is outside the viewport, no pair forms and each side animates independently as enter/exit.
- Use a constant defined in a shared module to avoid name collisions:

```jsx
// shared-names.ts
export const HERO_IMAGE = 'hero-image-detail';
```

---

## View Transition Events (JavaScript Animations)

For imperative control, use the `onEnter`, `onExit`, `onUpdate`, and `onShare` callbacks:

```jsx
<ViewTransition
  onEnter={(instance, types) => {
    const anim = instance.new.animate(
      [{ transform: 'scale(0.8)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: 300, easing: 'ease-out' }
    );
    return () => anim.cancel(); // always return cleanup
  }}
  onExit={(instance, types) => {
    const anim = instance.old.animate(
      [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.8)', opacity: 0 }],
      { duration: 200, easing: 'ease-in' }
    );
    return () => anim.cancel();
  }}
>
  <Component />
</ViewTransition>
```

The `instance` object provides:
- `instance.old` — the `::view-transition-old` pseudo-element
- `instance.new` — the `::view-transition-new` pseudo-element
- `instance.group` — the `::view-transition-group` pseudo-element
- `instance.imagePair` — the `::view-transition-image-pair` pseudo-element
- `instance.name` — the `view-transition-name` string

Always return a cleanup function that cancels the animation so the browser can properly handle interruptions.

Only one event fires per `<ViewTransition>` per Transition. `onShare` takes precedence over `onEnter` and `onExit`.

---

## Common Patterns

### Animate Enter/Exit of a Component

```jsx
import { ViewTransition, useState, startTransition } from 'react';

function App() {
  const [show, setShow] = useState(false);
  return (
    <>
      <button onClick={() => startTransition(() => setShow(s => !s))}>
        Toggle
      </button>
      {show && (
        <ViewTransition enter="fade-in" exit="fade-out">
          <Panel />
        </ViewTransition>
      )}
    </>
  );
}
```

### Animate List Reorder

Wrap each item (not a wrapper div) in `<ViewTransition>` with a stable `key`:

```jsx
{items.map(item => (
  <ViewTransition key={item.id}>
    <ItemCard item={item} />
  </ViewTransition>
))}
```

Triggering the reorder inside `startTransition` will smoothly animate each item to its new position. Avoid wrapper `<div>`s between the list and `<ViewTransition>` — they block the reorder animation.

### Animate Suspense Fallback to Content

Wrap `<Suspense>` in `<ViewTransition>` to cross-fade from fallback to loaded content:

```jsx
<ViewTransition>
  <Suspense fallback={<Skeleton />}>
    <AsyncContent />
  </Suspense>
</ViewTransition>
```

### Opt Out of Nested Animations

Wrap children in `<ViewTransition update="none">` to prevent them from animating when a parent changes:

```jsx
<ViewTransition>
  <div className={theme}>
    <ViewTransition update="none">
      {children}
    </ViewTransition>
  </div>
</ViewTransition>
```

### Preserve State with Activity

Use `<Activity>` with `<ViewTransition>` to animate show/hide while preserving component state:

```jsx
import { Activity, ViewTransition, startTransition } from 'react';

<Activity mode={isVisible ? 'visible' : 'hidden'}>
  <ViewTransition enter="slide-in" exit="slide-out">
    <Sidebar />
  </ViewTransition>
</Activity>
```

---

## Next.js Integration

Next.js supports React View Transitions. Enable it in `next.config.js` (or `next.config.ts`):

```js
const nextConfig = {
  experimental: {
    viewTransition: true,
  },
};
module.exports = nextConfig;
```

For a detailed guide on Next.js integration, including App Router patterns and Server Component considerations, read `references/nextjs.md`.

Key points:
- The `<ViewTransition>` component is imported from `react` directly — no Next.js-specific import.
- The `experimental.viewTransition` flag enables deeper integration with Next.js features beyond what `<ViewTransition>` provides on its own.
- Wrap page content in `<ViewTransition>` inside the layout to animate route transitions.
- Works with the App Router and `startTransition` + `router.push()` for programmatic navigation.

### The `transitionTypes` prop on `next/link`

As of Next.js 16.2+, `next/link` supports a native `transitionTypes` prop that eliminates the need for custom `TransitionLink` wrapper components. Instead of intercepting navigation with `onNavigate`, `startTransition`, and `addTransitionType`, you pass transition types directly:

```tsx
import Link from 'next/link';

// Before (manual wrapper required):
<TransitionLink href="/products/1" type="transition-to-detail">
  View Product
</TransitionLink>

// After (native prop, no wrapper needed):
<Link href="/products/1" transitionTypes={['transition-to-detail']}>
  View Product
</Link>
```

The `transitionTypes` prop accepts an array of strings — the same types you would pass to `addTransitionType`. This removes the need for `'use client'`, `useRouter`, and custom link components when all you need is to tag a navigation with a transition type. The `<ViewTransition>` components in the tree respond to these types the same way they respond to manual `addTransitionType` calls.

For full examples of `transitionTypes` with shared element transitions and directional animations across routes, see `references/nextjs.md`.

---

## Real-World Patterns

These patterns are drawn from production Next.js apps using View Transitions.

### List-to-Detail with `useDeferredValue` and `ViewTransition`

A common pattern is a client-side searchable grid where items expand into a detail view. Wrap each item in `<ViewTransition>` and use `useDeferredValue` to trigger animated updates as the user types:

```tsx
'use client';

import { useDeferredValue, useState, ViewTransition, Suspense } from 'react';

export default function TalksExplorer({ talksPromise }) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  return (
    <>
      <input
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        placeholder="Search talks..."
      />
      <ViewTransition>
        <Suspense fallback={<GridSkeleton />}>
          <TalksGrid talksPromise={talksPromise} search={deferredSearch} />
        </Suspense>
      </ViewTransition>
    </>
  );
}
```

When `deferredSearch` updates (deferred from the search input), React treats it as a transition and the `<ViewTransition>` wrapping the `<Suspense>` boundary cross-fades between the old and new grid content.

### Card Expand/Collapse with `startTransition`

Toggle between a card grid and a detail view using `startTransition` to animate the swap:

```tsx
'use client';

import { useState, startTransition, ViewTransition } from 'react';

export default function TalksGrid({ talks }) {
  const [expandedTalkId, setExpandedTalkId] = useState(null);

  return expandedTalkId ? (
    <ViewTransition enter="slide-up" exit="slide-down">
      <TalkDetails
        talk={talks.find(t => t.id === expandedTalkId)}
        closeAction={() => {
          startTransition(() => {
            setExpandedTalkId(null);
          });
        }}
      />
    </ViewTransition>
  ) : (
    <div className="grid grid-cols-3 gap-4">
      {talks.map(talk => (
        <ViewTransition key={talk.id}>
          <TalkCard
            talk={talk}
            onSelect={() => {
              startTransition(() => {
                setExpandedTalkId(talk.id);
              });
            }}
          />
        </ViewTransition>
      ))}
    </div>
  );
}
```

The CSS for slide-up/slide-down enter/exit:

```css
::view-transition-old(.slide-down) {
  animation: 150ms ease-out both fade-out, 150ms ease-out both slide-down;
}
::view-transition-new(.slide-up) {
  animation: 210ms ease-in 150ms both fade-in, 400ms ease-in both slide-up;
}

@keyframes slide-up {
  from { transform: translateY(10px); }
  to { transform: translateY(0); }
}
@keyframes slide-down {
  from { transform: translateY(0); }
  to { transform: translateY(10px); }
}
@keyframes fade-in {
  from { opacity: 0; }
}
@keyframes fade-out {
  to { opacity: 0; }
}
```

### Type-Safe Transition Helpers

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

These wrappers enforce that only valid transition IDs and animation classes are used, catching mistakes at compile time. See the Next.js App Router Playground (`vercel/next-app-router-playground`) for a complete example of this pattern.

### Shared Elements Across Routes in Next.js

See `references/nextjs.md` (Shared Elements Across Routes) for complete examples using `transitionTypes` on `next/link` combined with shared element `<ViewTransition name={...}>` for list-to-detail image morph animations.

---

## Accessibility

Always respect `prefers-reduced-motion`. React does not disable animations automatically for this preference. Add this to your global CSS:

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation-duration: 0s !important;
  }
}
```

Or disable specific animations conditionally in JavaScript events by checking the media query.

---

## Troubleshooting

**ViewTransition not activating:**
- Ensure the `<ViewTransition>` comes before any DOM node in the component (not wrapped in a `<div>`).
- Ensure the state update is inside `startTransition`, not a plain `setState`.

**"Two ViewTransition components with the same name" error:**
- Each `name` must be globally unique across the entire app at any point in time. Add item IDs: `name={\`hero-${item.id}\`}`.

**Back button skips animation:**
- The legacy `popstate` event requires synchronous completion, conflicting with view transitions. Upgrade your router to use the Navigation API for back-button animations.

**Animations from `flushSync` are skipped:**
- `flushSync` completes synchronously, which prevents view transitions from running. Use `startTransition` instead.

**Batching:**
- If multiple updates occur while an animation is running, React batches them into one. For example: if you navigate A→B, then B→C, then C→D during the first animation, the next animation will go B→D.

---

## CSS Recipe Reference

For ready-to-use CSS animation recipes (slide, fade, scale, flip, and combined patterns), see `references/css-recipes.md`.
