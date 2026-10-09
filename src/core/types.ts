import type { Story } from 'inkjs/engine/Story';

export type WorldValue = string | number | boolean;
export interface SourceRange { start: number; end: number; line: number }
export interface Knot {
  id: string;
  name: string;
  title: string;
  range: SourceRange;
  body: SourceRange;
  text: string;
  on?: string;
  when?: string;
  whenLine?: number;
  once?: 'save' | 'session';
  jumps: { target: string; range: SourceRange }[];
}
export interface Command { id: string; text: string; line: number; knot: string }
export interface Diagnostic { message: string; line?: number; severity: 'error' | 'warning' }
export interface StoryDocument {
  source: string;
  fingerprint: string;
  title: string;
  id: string;
  knots: Knot[];
  commands: Command[];
  variables: string[];
  layout: Record<string, { x: number; y: number }>;
  generatedInk: string;
  lineMap: number[];
  diagnostics: Diagnostic[];
}
export interface CompiledDocument extends StoryDocument { json: string; createStory: () => Story }
export type ActionStatus = 'running' | 'completed' | 'blocked' | 'cancelled' | 'actor_missing';
export interface Action {
  id: string;
  type: string;
  actor: string;
  destination: string;
  started: number;
  due: number;
  status: ActionStatus;
  instanceId: string;
  line: number;
  previousState?: WorldValue;
}
export interface Instance {
  id: string;
  knot: string;
  title: string;
  line: number;
  status: 'running' | 'continue' | 'waiting' | 'choices' | 'completed' | 'error';
  waiting?: { actionId: string; result?: string };
  handles: Record<string, string>;
}
export interface LogEntry {
  id: number;
  time: number;
  kind: 'event' | 'state' | 'story' | 'action' | 'error';
  title: string;
  detail?: string;
  line?: number;
}
export interface TranscriptEntry {
  id: number;
  time: number;
  kind: 'dialogue' | 'narration' | 'choice' | 'action' | 'continue';
  text: string;
  speaker?: string;
  instanceId: string;
  line?: number;
}
export interface ChoiceGroup { instanceId: string; title: string; choices: { index: number; text: string }[] }
export interface RuntimeSnapshot {
  schema: 1;
  fingerprint: string;
  inkState: string;
  time: number;
  serial: number;
  instances: Instance[];
  actions: Action[];
  transcript: TranscriptEntry[];
  logs: LogEntry[];
  fired: string[];
  autoExpandDialogue?: boolean;
}
