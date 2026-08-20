'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useUser, useClerk } from '@clerk/nextjs';
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

export default function UserAvatarButton() {
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

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger>
        <div
          role="button"
          tabIndex={0}
          className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-white/10 hover:ring-white/25 transition-transform duration-100 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acid-accent cursor-pointer"
          aria-label="Open user menu"
        >
          <Image
            src={`/Avatars/${selected}.svg`}
            alt="User avatar"
            width={40}
            height={40}
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
