/**
 * Desktop editor state shape and initial value.
 *
 * Two departures from the design's own `state = {}`:
 *
 * 1. `leftMode` is new. The design fixed the left column to the transcript and
 *    put Media in the inspector rail; here one column morphs media → transcript
 *    when a clip is chosen. See memory/project_desk_left_panel_morphs.md.
 * 2. `pro`, `lockKey` and `watermark` are gone. Locks were dropped with the
 *    free pivot, and the watermark is permanent attribution, not a setting.
 */

import type { Word } from '@Ordio/shared';
import type { BreakMode, BreakQuantity } from '@Ordio/engine/captions/breaks';
import type {
  AnimId,
  BedId,
  FormatId,
  SafeId,
  ToolId,
  VisualId,
} from './deskCatalog';

export type LeftMode = 'media' | 'transcript';
export type SheetId = 'export' | 'shortcuts' | 'palette' | 'settings' | null;
export type StyleTab = 'animation' | 'type' | 'colour' | 'layout';

export interface DeskLine {
  start: number;
  end: number;
  words: Word[];
}

export interface DeskState {
  /* Shell */
  leftMode: LeftMode;
  /* Collapse is chrome, not document state — deliberately outside Snapshot so
     undo never reopens a panel you closed. */
  leftCollapsed: boolean;
  /**
   * Whether the tool strip's panel is showing.
   *
   * Replaces `inspectorCollapsed`, and is not simply its inverse. The docked
   * inspector was always open on some tool and could only be hidden as a whole
   * column; the strip's panel has a genuine closed state where the canvas gets
   * the room, and `tool` then records which panel would come back.
   */
  toolOpen: boolean;
  tool: ToolId;
  sheet: SheetId;
  styleTab: StyleTab;

  /* Playback */
  playing: boolean;
  t: number;
  duration: number;
  zoom: number;

  /* Transcript */
  lines: DeskLine[];
  selRow: number;
  cursor: number | null;
  accents: number[];
  editing: number | null;
  findOpen: boolean;
  findText: string;
  replaceWith: string;
  copied: boolean;

  /* Source */
  clipId: string | null;
  clipName: string | null;

  /* Caption style */
  anim: AnimId;
  preset: string;
  font: string;
  fontSize: number;
  align: 'start' | 'center' | 'end';
  vAlign: 'auto' | 'top' | 'middle' | 'bottom';
  /* Stored as a raw line-height multiplier, the same shape as
     StyleConfig.lineHeight in packages/shared. */
  lineHeight: number;
  charSpacing: number;
  strokeW: number;
  /* 0–1. Rendered as a text-shadow halo in the stage colour. */
  glow: number;
  strokeColor: string;
  activeWordColor: string;
  activeWordBg: string;
  activeBgOn: boolean;
  emphasisColor: string;
  captionBg: string;
  capBgOn: boolean;
  capCase: 'none' | 'uppercase' | 'capitalize';
  autoFit: boolean;
  capHidden: boolean;

  /* Line breaking */
  breakMode: BreakMode;
  breakQty: BreakQuantity;
  breakSecs: number;
  applyAll: boolean;

  /* Canvas */
  visual: VisualId;
  artwork: string;
  textColor: string;
  waveColor: string;
  bgColor: string;

  /* Frame */
  format: FormatId;
  fit: 'fill' | 'fit';
  safe: SafeId;
  safeShow: boolean;

  /* Trim */
  trimIn: number;
  trimOut: number;
  cutPauses: number[];

  /* Audio */
  voiceLevel: number;
  normalize: boolean;
  bed: BedId;
  musicLevel: number;
  duck: boolean;

  /* Export */
  exKind: 'mp4' | 'srt' | 'vtt' | 'txt';
  exResolution: '720' | '1080' | '2160';
  exStage: 'setup' | 'running' | 'done';
  exportPct: number;
}

export const INITIAL_DESK_STATE: DeskState = {
  leftMode: 'media',
  leftCollapsed: false,
  /* Closed on arrival: nothing is loaded, so there is nothing to style. */
  toolOpen: false,
  tool: 'style',
  sheet: null,
  styleTab: 'animation',

  playing: false,
  t: 0,
  duration: 0,
  zoom: 1,

  lines: [],
  selRow: 0,
  cursor: null,
  accents: [],
  editing: null,
  findOpen: false,
  findText: '',
  replaceWith: '',
  copied: false,

  clipId: null,
  clipName: null,

  anim: 'reveal',
  preset: 'clean',
  font: 'Outfit',
  fontSize: 56,
  align: 'center',
  vAlign: 'auto',
  lineHeight: 1.15,
  charSpacing: 0,
  strokeW: 0,
  glow: 0,
  strokeColor: '#0a0b0a',
  activeWordColor: '#0a0b0a',
  activeWordBg: '#c6ff3d',
  activeBgOn: true,
  emphasisColor: '#6be0ff',
  captionBg: '#0a0b0a',
  capBgOn: false,
  capCase: 'none',
  autoFit: true,
  capHidden: false,

  breakMode: 'punct',
  breakQty: 4,
  breakSecs: 3,
  applyAll: true,

  visual: 'bars',
  artwork: 'Tamber',
  textColor: '#f4f5ef',
  waveColor: '#c6ff3d',
  bgColor: '#0a0b0a',

  format: 'vertical',
  fit: 'fill',
  safe: 'none',
  safeShow: false,

  trimIn: 0,
  trimOut: 0,
  cutPauses: [],

  voiceLevel: 100,
  normalize: true,
  bed: 'none',
  musicLevel: 24,
  duck: true,

  exKind: 'mp4',
  exResolution: '1080',
  exStage: 'setup',
  exportPct: 0,
};
