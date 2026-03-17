'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface FAQItem {
  q: string
  a: string
}

interface FAQAccordionProps {
  items: FAQItem[]
}

export function FAQAccordion({ items }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number>(-1)

  return (
    <div className="relative flex flex-col pl-0 lg:pl-10">
      {items.map((item, i) => {
        const isOpen = openIndex === i
        return (
          <div
            key={i}
            className={[
              'border-b border-white/[0.12] -mx-2.5 rounded-md cursor-pointer select-none transition-colors duration-150',
              isOpen ? 'bg-white/[0.03]' : 'hover:bg-white/[0.025]',
            ].join(' ')}
            onClick={() => setOpenIndex(isOpen ? -1 : i)}
          >
            <div className="flex items-center justify-between gap-4 py-5 min-h-11">
              <span className={[
                'text-[length:var(--text-body)] leading-relaxed transition-colors duration-150',
                isOpen ? 'text-white/90' : 'text-white/60',
              ].join(' ')}>
                {item.q}
              </span>
              <motion.svg
                className="w-[18px] h-[18px] flex-shrink-0"
                style={{ color: isOpen ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)' }}
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </motion.svg>
            </div>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                  className="overflow-hidden"
                >
                  <p className="text-[length:var(--text-body-sm)] text-white/45 leading-[1.8] pb-5">
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
