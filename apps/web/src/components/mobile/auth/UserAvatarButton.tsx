'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useUser, useClerk } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from '@Ordio/convex';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

const AVATARS = ['3D01', '3D01-1', '3D03', '3D04', '3D06'];
const STORAGE_KEY = 'ordio-selected-avatar';

function getStoredAvatar(): string {
  if (typeof window === 'undefined') return AVATARS[0];
  return localStorage.getItem(STORAGE_KEY) ?? AVATARS[0];
}

function setStoredAvatar(id: string) {
  localStorage.setItem(STORAGE_KEY, id);
}

interface UserAvatarButtonProps {
  /**
   * `md` (40px) is the mobile header's size. The desk's top bar runs 30–34px
   * controls, where 40 reads as an outsized blob beside the Export button, so
   * it gets `sm`. A size prop rather than a second component: the avatar
   * picker, Manage Account and Sign Out are the same menu on both.
   */
  size?: 'sm' | 'md';
}

export default function UserAvatarButton({ size = 'md' }: UserAvatarButtonProps) {
  const px = size === 'sm' ? 32 : 40;
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [selected, setSelected] = useState(AVATARS[0]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSelected(getStoredAvatar());
  }, []);

  const handleSelect = (id: string) => {
    setSelected(id);
    setStoredAvatar(id);
  };

  const displayName = user?.firstName ?? user?.username ?? 'User';
  const email = user?.emailAddresses?.[0]?.emailAddress ?? '';

  /* Undefined while the query is in flight, null when signed out — both mean
     "nothing to show yet" rather than "zero", which would be a different and
     alarming claim. */
  const credits = useQuery(api.credits.getMyCredits);
  const spent = credits !== undefined && credits !== null && credits.credits <= 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger>
        <div
          role="button"
          tabIndex={0}
          className={cn(
            'rounded-full overflow-hidden ring-1 ring-white/10 hover:ring-white/25 transition-transform duration-100 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acid-accent cursor-pointer',
            size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
          )}
          aria-label="Open user menu"
        >
          <Image
            src={`/Avatars/${selected}.svg`}
            alt="User avatar"
            width={px}
            height={px}
            className="w-full h-full object-cover"
          />
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 p-2">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-3 py-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground truncate">{displayName}</span>
              {email && <span className="text-xs text-muted-foreground truncate">{email}</span>}
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {/* The balance is the only thing that decides whether recording will
              work at all, and it was readable nowhere in the product — running
              out surfaced as a waitlist sheet with no stated cause. */}
          {credits !== undefined && credits !== null && (
            <div className="px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted-foreground">Credits</span>
                <span
                  className={cn(
                    'text-sm font-medium tabular-nums',
                    spent ? 'text-destructive' : 'text-foreground'
                  )}
                >
                  {credits.credits}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {spent
                  ? 'Out of transcription credits'
                  : `About ${credits.minutes} min of transcription left`}
              </p>
            </div>
          )}

          <DropdownMenuSeparator />

          <div className="px-3 py-2">
            <p className="text-xs text-muted-foreground mb-2">Avatar</p>
            <div className="flex gap-2">
              {AVATARS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelect(id)}
                  className={cn(
                    'w-9 h-9 rounded-full overflow-hidden ring-1 ring-white/10 transition-transform duration-100 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-105',
                    selected === id && 'ring-2 ring-acid-accent'
                  )}
                  aria-label={`Select avatar ${id}`}
                  aria-pressed={selected === id}
                >
                  <Image
                    src={`/Avatars/${id}.svg`}
                    alt={id}
                    width={36}
                    height={36}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => {
              setOpen(false);
              openUserProfile();
            }}
            className="cursor-pointer"
          >
            Manage Account
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            variant="destructive"
            className="cursor-pointer"
          >
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
