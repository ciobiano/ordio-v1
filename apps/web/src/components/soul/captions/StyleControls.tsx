'use client';

import { useMemo, useState } from 'react';
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
      <TabsList
        variant="line"
        className={cn(
          'h-9 w-full shrink-0 justify-start gap-2.5 overflow-x-auto border-b p-0',
          'border-[color:var(--acid-border-default)] bg-transparent',
          '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        )}
      >
        {STYLE_TABS.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className={cn(
              'shrink-0 px-0 text-[10.5px] font-semibold uppercase tracking-[0.03em]',
              'text-[color:var(--acid-text-3)] transition-colors duration-[var(--acid-dur-tap)]',
              'after:bg-[color:var(--acid-accent)]',
              'data-active:text-[color:var(--acid-accent)]'
            )}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <div
        role="tabpanel"
        aria-label={`${activeTab} style controls`}
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-0.5 pb-1',
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
