'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { SessionSummary } from './types';

type SavedAudioDialogsProps = {
  editingSession: SessionSummary | null;
  draftName: string;
  setDraftName: (value: string) => void;
  isRenaming: boolean;
  onRename: () => void;
  onCloseRename: () => void;
  deleteTarget: SessionSummary | null;
  isDeleting: boolean;
  onDelete: () => void;
  onCloseDelete: () => void;
};

export function SavedAudioDialogs({
  editingSession,
  draftName,
  setDraftName,
  isRenaming,
  onRename,
  onCloseRename,
  deleteTarget,
  isDeleting,
  onDelete,
  onCloseDelete,
}: SavedAudioDialogsProps) {
  return (
    <>
      <Dialog
        open={editingSession !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onCloseRename();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="mobile-glass max-w-[calc(100%-1.5rem)] rounded-[2rem] border border-white/10 bg-slate-950/88 p-5 text-white"
        >
          <DialogHeader>
            <DialogTitle className="text-lg text-white">Rename saved audio</DialogTitle>
            <DialogDescription className="text-white/55">
              Give this recording a clearer label for faster reuse.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Recording name"
            className="h-12 rounded-2xl border-white/10 bg-white/6 text-white placeholder:text-white/30"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={onCloseRename}
              className="rounded-2xl text-white/70 hover:bg-white/8 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onRename}
              disabled={isRenaming || draftName.trim().length === 0}
              className="rounded-2xl bg-white text-slate-950 hover:bg-white/90"
            >
              {isRenaming ? 'Saving…' : 'Save name'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onCloseDelete();
        }}
      >
        <AlertDialogContent
          className="mobile-glass max-w-[calc(100%-1.5rem)] rounded-[2rem] border border-white/10 bg-slate-950/88 text-white"
        >
          <AlertDialogHeader className="place-items-start text-left">
            <AlertDialogTitle className="text-white">Delete saved audio?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/55">
              {deleteTarget ? `"${deleteTarget.name}" will be removed from your library.` : 'This audio will be removed from your library.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl border-white/10 bg-white/6 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              disabled={isDeleting}
              className="rounded-2xl bg-red-500/90 text-white hover:bg-red-500"
            >
              {isDeleting ? 'Deleting…' : 'Delete audio'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

