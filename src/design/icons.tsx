import type { CSSProperties, HTMLAttributes } from 'react';

type IconProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & { size?: number | string; strokeWidth?: number; fill?: string };

// Official, locally hosted Material Symbols Rounded. Keep icons decorative;
// controls supply their own text labels and accessible names.
function icon(name: string) {
  return function MaterialIcon({ size = 20, fill, strokeWidth: _strokeWidth, className = '', style, ...props }: IconProps) {
    const dimension = typeof size === 'number' ? size + 'px' : size;
    const geometry: CSSProperties = { fontSize: 'var(--icon-size, ' + dimension + ')', width: 'var(--icon-size, ' + dimension + ')', height: 'var(--icon-size, ' + dimension + ')', ...style };
    if (fill) geometry.fontVariationSettings = "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24";
    return <span {...props} className={'material-symbols ' + className} aria-hidden="true" data-symbol={name} style={geometry} />;
  };
}

export const AlertCircle = icon('error');
export const ArrowDown = icon('arrow_downward');
export const ArrowDownRight = icon('subdirectory_arrow_right');
export const ArrowRight = icon('arrow_forward');
export const ArrowUp = icon('arrow_upward');
export const ArrowUpRight = icon('north_east');
export const BookOpen = icon('menu_book');
export const Check = icon('check');
export const CheckCircle2 = icon('check_circle');
export const ChevronDown = icon('expand_more');
export const ChevronRight = icon('chevron_right');
export const Clock3 = icon('schedule');
export const Download = icon('download');
export const FileCode2 = icon('description');
export const FilePlus2 = icon('note_add');
export const FileText = icon('article');
export const FolderOpen = icon('folder_open');
export const GitBranch = icon('account_tree');
export const Hash = icon('tag');
export const Import = icon('upload_file');
export const ListFilter = icon('history');
export const Maximize2 = icon('fullscreen');
export const MessageCircle = icon('chat_bubble');
export const MessageSquare = icon('chat');
export const Minimize2 = icon('fullscreen_exit');
export const MoreHorizontal = icon('more_horiz');
export const Network = icon('hub');
export const Play = icon('play_arrow');
export const RotateCcw = icon('restart_alt');
export const Route = icon('route');
export const Save = icon('save');
export const SlidersHorizontal = icon('tune');
export const Sparkles = icon('auto_awesome');
export const X = icon('close');
export const XCircle = icon('cancel');
export const Zap = icon('bolt');
