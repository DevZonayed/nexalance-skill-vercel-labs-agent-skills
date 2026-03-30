# View Transitions in Next.js

## Table of Contents

1. [Setup](#setup)
2. [Basic Route Transitions](#basic-route-transitions)
3. [Layout-Level ViewTransition](#layout-level-viewtransition)
4. [The transitionTypes Prop on next/link](#the-transitiontypes-prop-on-nextlink)
5. [Programmatic Navigation with Transitions](#programmatic-navigation-with-transitions)
6. [Transition Types for Navigation Direction](#transition-types-for-navigation-direction)
7. [Shared Elements Across Routes](#shared-elements-across-routes)
8. [Combining with Suspense and Loading States](#combining-with-suspense-and-loading-states)
9. [Server Components Considerations](#server-components-considerations)

---

## Setup

`<ViewTransition>` works in Next.js out of the box for `startTransition`- and `Suspense`-triggered updates — no config flag is needed for those.

To also animate `<Link>` navigations, enable the experimental flag in `next.config.js` (or `next.config.ts`):

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    viewTransition: true,
  },
};
module.exports = nextConfig;
```

**What this flag does at runtime:** It wraps every `<Link>` navigation in `document.startViewTransition`. This means all mounted `<ViewTransition>` components in the tree participate in every link navigation — not just transitions triggered by `startTransition` or `Suspense`.

Implications:
- Any `<ViewTransition>` with `default="auto"` (the implicit default) fires the browser's cross-fade on **every** `<Link>` navigation.
- Combined with per-page `<ViewTransition>` components (Suspense reveals, item animations), this produces competing animations.
- Without this flag, `<ViewTransition>` still works for all `startTransition`- and `Suspense`-triggered updates — only `<Link>` navigations won't participate.

The `<ViewTransition>` component is currently available in `react@canary` and `react@experimental` only:

```bash
npm install react@canary react-dom@canary
```

---

## Layout-Level ViewTransition

**If your pages already have `<ViewTransition>` components (Suspense reveals, item reorder, shared elements), do NOT add a layout-level `<ViewTransition>` wrapping `{children}` with `default="auto"`.** Both levels fire simultaneously inside a single `document.startViewTransition` — the layout cross-fades the entire old page while the new page's own animations run at the same time. The result is competing, broken-looking animations.

This is the most common view transition mistake in Next.js. Every developer tries this first:

```tsx
// app/layout.tsx — ONLY use this if pages have NO per-page ViewTransitions
import { ViewTransition } from 'react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>{/* navigation links */}</nav>
        <ViewTransition>
          {children}
        </ViewTransition>
      </body>
    </html>
  );
}
```

This works for simple apps where pages have **no** `<ViewTransition>` components of their own. The layout detects the content swap on navigation and applies the default cross-fade.

**But the moment any page adds its own `<ViewTransition>` (a Suspense slide-up, an item reorder, a shared element), remove the layout-level one or set `default="none"` on it.** Otherwise both levels animate in parallel, not sequentially.

For apps that need layout-level control, use `default="none"` and only activate for specific `transitionTypes`:

```tsx
// app/dashboard/layout.tsx
import { ViewTransition } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard">
      <Sidebar />
      <main>
        <ViewTransition
          default="none"
          enter={{
            'nav-forward': 'nav-forward',
            'nav-back': 'nav-back',
            default: 'none',
          }}
          exit={{
            'nav-forward': 'nav-forward',
            'nav-back': 'nav-back',
            default: 'none',
          }}
        >
          {children}
        </ViewTransition>
      </main>
    </div>
  );
}
```

Only the content area animates, only when explicit navigation types are present, and the sidebar stays static.

**Even with `default="none"`, a layout-level directional slide will fire simultaneously with any per-page Suspense `<ViewTransition>`s.** If a page has `<ViewTransition enter="slide-up">` on a Suspense boundary, and the layout slides in from the right, both run at once — producing a diagonal movement. If your pages use Suspense reveals with `<ViewTransition>`, directional layout transitions usually hurt more than they help — the Suspense slide-up/slide-down already communicates "new content loading."

---

## The `transitionTypes` Prop on `next/link`

`next/link` supports a native `transitionTypes` prop. This eliminates the need for custom wrapper components that intercept navigation with `onNavigate` + `startTransition` + `addTransitionType` + `router.push()`.

### Before (manual wrapper, requires `'use client'`)

```tsx
'use client';

import { addTransitionType, startTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function TransitionLink({ type, ...props }: { type: string } & React.ComponentProps<typeof Link>) {
  const router = useRouter();

  return (
    <Link
      onNavigate={(event) => {
        event.preventDefault();
        startTransition(() => {
          addTransitionType(type);
          router.push(props.href as string);
        });
      }}
      {...props}
    />
  );
}
```

### After (native prop, no wrapper needed, works in Server Components)

```tsx
import Link from 'next/link';

<Link href="/products/1" transitionTypes={['transition-to-detail']}>
  View Product
</Link>
```

The `transitionTypes` prop accepts an array of strings. These types are passed to the View Transition system the same way `addTransitionType` would. `<ViewTransition>` components in the tree respond to these types identically.

This is the recommended approach for link-based navigation transitions. Reserve manual `startTransition` + `addTransitionType` for programmatic navigation (buttons, form submissions, etc.) where `next/link` isn't used.

---

## Programmatic Navigation with Transitions

Use `startTransition` with Next.js's `router.push()` to trigger view transitions from code:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { startTransition, addTransitionType } from 'react';

export function NavigateButton({ href }: { href: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        startTransition(() => {
          addTransitionType('navigation-forward');
          router.push(href);
        });
      }}
    >
      Go to {href}
    </button>
  );
}
```

Wrapping `router.push()` in `startTransition` is what activates the `<ViewTransition>` boundaries in the tree.

---

## Transition Types for Navigation Direction

A common pattern is to animate differently for forward vs. backward navigation.

### Using `transitionTypes` on `next/link` (preferred)

```tsx
import Link from 'next/link';

// Forward navigation
<Link href="/products/1" transitionTypes={['transition-forwards']}>
  Next →
</Link>

// Backward navigation
<Link href="/products" transitionTypes={['transition-backwards']}>
  ← Back
</Link>
```

### Using `startTransition` + `addTransitionType` (for programmatic navigation)

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { startTransition, addTransitionType } from 'react';

export function NavigateButton({
  href,
  direction = 'forward',
  children,
}: {
  href: string;
  direction?: 'forward' | 'back';
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        startTransition(() => {
          addTransitionType(`navigation-${direction}`);
          router.push(href);
        });
      }}
    >
      {children}
    </button>
  );
}
```

Configure `<ViewTransition>` in the layout to respond to these types. See the Layout-Level ViewTransition section above for the `default="none"` pattern with type-keyed `enter`/`exit` maps.

**When to skip directional nav transitions:** If your pages already use Suspense reveals with `<ViewTransition>` (priority #2 in the Hierarchy of Animation Intent), adding route-level directional transitions (priority #5) usually hurts more than it helps. The Suspense slide-up/slide-down already communicates "new content loading" — adding a horizontal slide on top produces a diagonal movement where both animations fight for attention. Prefer shared element transitions (#1) or just let Suspense handle it.

---

## Shared Elements Across Routes

Animate a thumbnail expanding into a full image across route transitions. Use `transitionTypes` on the link to tag the navigation direction:

```tsx
// app/products/page.tsx (list page)
import { ViewTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function ProductList({ products }) {
  return (
    <div className="grid grid-cols-3 gap-6">
      {products.map((product) => (
        <Link
          key={product.id}
          href={`/products/${product.id}`}
          transitionTypes={['transition-to-detail']}
        >
          <ViewTransition name={`product-${product.id}`}>
            <Image src={product.image} alt={product.name} width={400} height={300} />
          </ViewTransition>
          <p>{product.name}</p>
        </Link>
      ))}
    </div>
  );
}
```

```tsx
// app/products/[id]/page.tsx (detail page)
import { ViewTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function ProductDetail({ product }) {
  return (
    <article>
      <Link href="/products" transitionTypes={['transition-to-list']}>
        ← Back to Products
      </Link>
      <ViewTransition name={`product-${product.id}`}>
        <Image src={product.image} alt={product.name} width={800} height={600} />
      </ViewTransition>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
    </article>
  );
}
```

Only one `<ViewTransition>` with a given name can be mounted at a time. Since Next.js unmounts the old page and mounts the new page within the same transition, the two `product-${product.id}` boundaries form a shared element pair and the image morphs from its thumbnail size to its full size.

---

## Combining with Suspense and Loading States

Next.js `loading.tsx` files create `<Suspense>` boundaries. Wrap them with `<ViewTransition>` for smooth fallback-to-content reveals. Place the Suspense `<ViewTransition>` in the page, not alongside a layout-level one:

```tsx
// In a page or page-level component — NOT in a layout that also has a ViewTransition on {children}
<Suspense
  fallback={
    <ViewTransition exit="slide-down">
      <DashboardSkeleton />
    </ViewTransition>
  }
>
  <ViewTransition default="none" enter="slide-up">
    <DashboardContent />
  </ViewTransition>
</Suspense>
```

The skeleton slides out, then the content slides in. `default="none"` on the content prevents it from re-animating on unrelated transitions.

**Do not combine this with a layout-level `<ViewTransition>` that has `default="auto"`.** Both will fire simultaneously — the layout cross-fades the whole page while the Suspense boundary slides up content, producing a broken double-animation. If you need both, set `default="none"` on the layout-level one and only activate it for specific `transitionTypes`.

---

## Server Components Considerations

- `<ViewTransition>` can be used in both Server and Client Components — it renders no DOM of its own.
- `<Link>` with `transitionTypes` works in Server Components — no `'use client'` directive needed for link-based transitions.
- `addTransitionType` must be called from a Client Component (inside an event handler with `startTransition`).
- `startTransition` for programmatic navigation must be called from a Client Component.
- Navigation via `<Link>` from `next/link` triggers transitions automatically when the experimental flag is enabled.
- Prefer `transitionTypes` on `<Link>` over custom wrapper components. Only use manual `startTransition` + `addTransitionType` + `router.push()` for non-link interactions (buttons, form submissions, etc.).
