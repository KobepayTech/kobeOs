# KobeOS multimode storefront (foundation)

One merchant, one inventory, one checkout and one KobePay integration. The classic catalog stays optional.

The `MultiModeStorefront` component provides five selectable shopping experiences: Explore, Catalog, Showroom, Watch and Ask AI. Each view is supplied by the existing shop application; unavailable experiences are hidden rather than presenting a broken placeholder. Selection is remembered per store in browser localStorage. This is a frontend foundation, **not** a claim that video feeds, 3D, live streaming, AI shopping or merchant publishing have been implemented.

## Integration
Import `MultiModeStorefront` from `src/components/storefront/MultiModeStorefront` and pass the store slug plus actual view components:

```tsx
<MultiModeStorefront
  storeId={slug}
  defaultMode="classic"
  views={{
    classic: <ExistingProductCatalog />,
    live: liveEnabled ? <ExistingLiveShopping /> : undefined,
  }}
/>
```

Next steps: wire into the published store router; persist merchant-enabled modes and default mode server-side; integrate existing live-sales, product feed and AI services; share cart state; implement visual drag-and-drop layout editor; add keyboard/accessibility and integration tests. No production deployment is implied.
