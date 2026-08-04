'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { FeatureKey } from '@/lib/featureGates';
import { MotionTab } from './style/tabs/MotionTab';
import { ColorsTab } from './style/tabs/ColorsTab';
import { FontTab } from './style/tabs/FontTab';
import { BreaksTab } from './style/tabs/BreaksTab';
import { TemplatesTab } from './style/tabs/TemplatesTab';
import { LayoutTab } from './style/tabs/LayoutTab';
import { VisualTab } from './style/tabs/VisualTab';

/** Tab order is the design's. */
const STYLE_TABS = [
  { id: 'motion', label: 'Motion' },
  { id: 'colors', label: 'Colors' },
  { id: 'font', label: 'Font' },
  { id: 'breaks', label: 'Breaks' },
  { id: 'templates', label: 'Templates' },
  { id: 'layout', label: 'Layout' },
  { id: 'visual', label: 'Visual' },
] as const;

export type StyleTabId = (typeof STYLE_TABS)[number]['id'];

interface StyleControlsProps {
  onLocked?: (feature: FeatureKey) => void;
  /** Tab to open on. Callers that deep-link here (Add ▸ Pick artwork) should
   *  also pass it as a `key` so a jump remounts onto the requested tab. */
  initialTab?: StyleTabId;
}

/**
 * Shell for the Style panel: the tab strip, and the slide transition between
 * panels. Every tab's content lives in its own file under `tabs/`.
 *
 * This used to be one 667-line component holding all five tab bodies in a
 * single `renderActiveTab()` switch. The redesign takes it to seven tabs and
 * roughly triples the Colors tab, so the split is what makes the rest of the
 * work tractable.
 */
export default function StyleControls({ onLocked, initialTab = 'motion' }: StyleControlsProps) {
  const [activeTab, setActiveTab] = useState<StyleTabId>(initialTab);
  const [previousTab, setPreviousTab] = useState<StyleTabId>(initialTab);
  const reduceMotion = useReducedMotion();
  const stripRef = useRef<HTMLDivElement>(null);

  // Seven tabs do not fit a phone, so the strip scrolls — which means the active
  // tab can be off-screen. That is not hypothetical: Add ▸ Pick artwork deep-links
  // straight to Templates, the fifth tab, which starts out of view.
  //
  // `block: 'nearest'` is the load-bearing part. Without it the browser also
  // scrolls the nearest vertical ancestor, which here is the panel body — so
  // bringing a tab into view would yank the controls underneath it.
  useEffect(() => {
    const active = stripRef.current?.querySelector<HTMLElement>(
      '[data-slot="tabs-trigger"][data-active]'
    );
    active?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      inline: 'nearest',
      block: 'nearest',
    });
  }, [activeTab, reduceMotion]);

  // Slide in the direction of travel along the tab strip, so the motion maps
  // to which way the user moved rather than always running one way.
  const slideDirection = useMemo(() => {
    const next = STYLE_TABS.findIndex((tab) => tab.id === activeTab);
    const prev = STYLE_TABS.findIndex((tab) => tab.id === previousTab);
    return next >= prev ? 1 : -1;
  }, [activeTab, previousTab]);

  const handleTabChange = (value: string) => {
    const nextTab = value as StyleTabId;
    if (nextTab === activeTab) return;
    if (!STYLE_TABS.some((tab) => tab.id === nextTab)) return;
    setPreviousTab(activeTab);
    setActiveTab(nextTab);
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="flex h-full min-h-0 flex-col gap-3 overflow-hidden"
    >
      {/* The scroll port is this wrapper, not the list.
          Two reasons. `overflow-x: auto` can never pair with `overflow-y: visible`
          — CSS forces the other axis to `auto` too — so the axis has to be pinned
          shut explicitly or the strip scrolls vertically as well. And the active
          underline sits a pixel proud of the trigger box; with the port on the
          list itself that pixel was enough to create the second scroll axis.
          Owning the border here also keeps the rule fixed to the visible width
          instead of scrolling away with the tabs. */}
      <div
        ref={stripRef}
        className={cn(
          'shrink-0 overflow-x-auto overflow-y-hidden border-b',
          'border-[color:var(--acid-border-default)]',
          // touch-pan-x hands the browser the sideways scroll and keeps the
          // vertical axis for the sheet drag. Without it the tabs inherit
          // `touch-action: manipulation` from the global button rule, the
          // browser treats a downward swipe here as a pan of its own, and the
          // drag never reaches framer.
          'touch-pan-x',
          '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        )}
      >
        <TabsList
          variant="line"
          // h-11, not h-9: 44px is the floor for a touch target, and the row is
          // what provides it — the labels themselves are 10.5px.
          // The prefix is required. The base component sets its height as
          // `group-data-horizontal/tabs:h-9`, which outranks a bare `h-11` on
          // specificity, so an unprefixed override silently loses.
          className={cn(
            'w-max justify-start gap-0 border-0 bg-transparent p-0',
            'group-data-horizontal/tabs:h-11'
          )}
        >
          {STYLE_TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              // `flex-none`, not `shrink-0`. The base sets `flex-1`; tailwind-merge
              // files `flex-*` and `shrink-*` under different keys, so adding
              // `shrink-0` kept BOTH and resolved to `flex: 1 1 0%` + `shrink: 0`.
              // Seven tabs each claimed a seventh of the width while `min-width:
              // auto` floored them at their text — hence the ragged widths.
              // `flex-none` shares a key with `flex-1` and actually replaces it.
              className={cn(
                'flex-none px-3 text-[10.5px] font-semibold uppercase tracking-[0.03em]',
                'text-[color:var(--acid-text-3)] transition-colors duration-[var(--acid-dur-tap)]',
                // Paper, not lime. A tab marks position, and position is never
                // the accent's job — see DESIGN.md §4.
                'after:bg-[color:var(--acid-text-1)]',
                'data-active:text-[color:var(--acid-text-1)]',
                // Sit the underline on the rule rather than 5px below it, where
                // the base component puts it.
                'group-data-horizontal/tabs:after:-bottom-px'
              )}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <div
        role="tabpanel"
        aria-label={`${activeTab} style controls`}
        className={cn(
          // touch-pan-y: this scroller owns the vertical axis, the sheet does
          // not. overscroll-contain keeps a swipe past its end from chaining
          // out to the page.
          'min-h-0 flex-1 touch-pan-y overflow-y-auto overflow-x-hidden overscroll-contain px-0.5 pb-1',
          '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: slideDirection * 14 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: slideDirection * -14 }}
            transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
            className="w-full pb-2"
          >
            {activeTab === 'motion' && <MotionTab onLocked={onLocked} />}
            {activeTab === 'colors' && <ColorsTab />}
            {activeTab === 'font' && <FontTab onLocked={onLocked} />}
            {activeTab === 'breaks' && <BreaksTab />}
            {activeTab === 'templates' && <TemplatesTab onLocked={onLocked} />}
            {activeTab === 'layout' && <LayoutTab />}
            {activeTab === 'visual' && <VisualTab onLocked={onLocked} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </Tabs>
  );
}
