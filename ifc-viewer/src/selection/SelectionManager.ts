/**
 * Framework-agnostic selection manager for Three.js viewers.
 *
 * Handles all input (mouse / keyboard), rubber-band visuals, cursor
 * indicator, and drag-direction detection.
 *
 * Delegates actual selection application to callbacks so it stays
 * decoupled from any specific fragment / highlight system.
 *
 * Selection modifiers (same key on all platforms):
 *   No modifier → replace selection
 *   Shift       → toggle (add if absent, remove if present)
 *   Ctrl        → add to selection
 *   Alt/Option  → remove from selection
 *   Escape      → clear all
 *
 * Rectangle drag direction (industry standard):
 *   Left → right = window selection (solid border, fully enclosed)
 *   Right → left = crossing selection (dashed border, intersecting)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SelectionModifier = 'replace' | 'add' | 'toggle' | 'subtract';

export interface SelectionRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SelectionManagerOptions {
  /** Minimum drag distance in px before rectangle selection starts. @default 5 */
  dragThreshold?: number;

  /** Called when the user finishes a rectangle drag. */
  onRectangleSelect?: (
    rect: SelectionRect,
    windowMode: boolean,
    modifier: SelectionModifier,
  ) => Promise<void>;

  /**
   * Called on a single click when a modifier key is held.
   * For plain clicks (no modifier) the Highlighter handles it.
   */
  onClickSelect?: (modifier: SelectionModifier) => void;

  /** Called when Escape is pressed. */
  onSelectionCleared?: () => void;

  /** Called when a drag starts / ends so the consumer can disable camera controls. */
  onDragStateChanged?: (isDragging: boolean) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveModifier(e: MouseEvent | KeyboardEvent): SelectionModifier {
  // Priority: Alt > Ctrl > Shift (most specific wins)
  if (e.altKey) return 'subtract';
  if (e.ctrlKey || e.metaKey) return 'add';
  if (e.shiftKey) return 'toggle';
  return 'replace';
}

const INDICATOR: Record<Exclude<SelectionModifier, 'replace'>, { text: string; color: string }> = {
  add:      { text: '+', color: '#9664ff' },
  toggle:   { text: '±', color: '#ffa500' },
  subtract: { text: '−', color: '#ff3333' },
};

const RECT_COLORS: Record<Exclude<SelectionModifier, 'replace'>, { border: string; bg: string }> = {
  add:      { border: 'rgba(150,100,255,0.9)', bg: 'rgba(150,100,255,0.08)' },
  toggle:   { border: 'rgba(255,170,0,0.9)',   bg: 'rgba(255,170,0,0.08)' },
  subtract: { border: 'rgba(255,50,50,0.9)',    bg: 'rgba(255,50,50,0.08)' },
};

// ---------------------------------------------------------------------------
// SelectionManager
// ---------------------------------------------------------------------------

export class SelectionManager {
  private opts: Required<SelectionManagerOptions>;

  private canvas: HTMLCanvasElement | null = null;
  private selectDiv: HTMLDivElement | null = null;
  private cursorIndicator: HTMLDivElement | null = null;

  private startX = 0;
  private startY = 0;
  private isDragging = false;

  private _onPointerDown: ((e: PointerEvent) => void) | null = null;
  private _onMouseMove: ((e: MouseEvent) => void) | null = null;
  private _onPointerUp: ((e: PointerEvent) => void) | null = null;
  private _onMouseLeave: (() => void) | null = null;
  private _onWindowMouseMove: ((e: MouseEvent) => void) | null = null;
  private _onKeyDown: ((e: KeyboardEvent) => void) | null = null;

  constructor(options: SelectionManagerOptions = {}) {
    const noop = () => {};
    this.opts = {
      dragThreshold: options.dragThreshold ?? 5,
      onRectangleSelect: options.onRectangleSelect ?? (async () => {}),
      onClickSelect: options.onClickSelect ?? noop,
      onSelectionCleared: options.onSelectionCleared ?? noop,
      onDragStateChanged: options.onDragStateChanged ?? noop,
    };
  }

  // -------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------

  attach(canvas: HTMLCanvasElement): void {
    if (this.canvas) this.detach();
    this.canvas = canvas;
    this.createOverlays();
    this.bindEvents();
  }

  detach(): void {
    this.unbindEvents();
    this.removeOverlays();
    this.canvas = null;
  }

  clearSelection(): void {
    this.opts.onSelectionCleared();
  }

  // -------------------------------------------------------------------
  // DOM overlays
  // -------------------------------------------------------------------

  private createOverlays(): void {
    const div = document.createElement('div');
    div.style.cssText =
      'position:fixed;pointer-events:none;display:none;z-index:500;';
    document.body.appendChild(div);
    this.selectDiv = div;

    const cursor = document.createElement('div');
    cursor.style.cssText =
      'position:fixed;pointer-events:none;display:none;z-index:1000;' +
      'font-size:20px;font-weight:bold;text-shadow:0 0 3px white;';
    document.body.appendChild(cursor);
    this.cursorIndicator = cursor;
  }

  private removeOverlays(): void {
    this.selectDiv?.parentNode?.removeChild(this.selectDiv);
    this.cursorIndicator?.parentNode?.removeChild(this.cursorIndicator);
    this.selectDiv = null;
    this.cursorIndicator = null;
  }

  // -------------------------------------------------------------------
  // Rubber-band styling
  // -------------------------------------------------------------------

  private updateSelectDiv(x1: number, y1: number, x2: number, y2: number, modifier: SelectionModifier): void {
    if (!this.selectDiv) return;

    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    const isCrossing = x2 < x1;

    let borderColor: string;
    let backgroundColor: string;

    if (modifier !== 'replace') {
      const colors = RECT_COLORS[modifier];
      borderColor = colors.border;
      backgroundColor = colors.bg;
    } else if (isCrossing) {
      borderColor = 'rgba(0,200,100,0.9)';
      backgroundColor = 'rgba(0,200,100,0.06)';
    } else {
      borderColor = 'rgba(50,130,255,0.9)';
      backgroundColor = 'rgba(50,130,255,0.06)';
    }

    Object.assign(this.selectDiv.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      border: `1px ${isCrossing ? 'dashed' : 'solid'} ${borderColor}`,
      background: backgroundColor,
    });
  }

  // -------------------------------------------------------------------
  // Cursor indicator
  // -------------------------------------------------------------------

  private updateCursorIndicator(modifier: SelectionModifier, x?: number, y?: number): void {
    if (!this.cursorIndicator) return;

    if (modifier !== 'replace') {
      const ind = INDICATOR[modifier];
      this.cursorIndicator.style.display = 'block';
      this.cursorIndicator.textContent = ind.text;
      this.cursorIndicator.style.color = ind.color;
      if (x !== undefined && y !== undefined) {
        this.cursorIndicator.style.left = `${x + 12}px`;
        this.cursorIndicator.style.top = `${y - 8}px`;
      }
    } else {
      this.cursorIndicator.style.display = 'none';
    }
  }

  // -------------------------------------------------------------------
  // Event binding
  // -------------------------------------------------------------------

  private bindEvents(): void {
    const canvas = this.canvas!;

    // Use pointer events (not mouse) — the Highlighter uses pointerdown/up,
    // so we must use the same event type + capture phase to run first.
    this._onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.isDragging = false;
      this.updateCursorIndicator(resolveModifier(e), e.clientX, e.clientY);
    };

    this._onMouseMove = (e: MouseEvent) => {
      if (!(e.buttons & 1)) return;

      const modifier = resolveModifier(e);
      this.updateCursorIndicator(modifier, e.clientX, e.clientY);

      const dx = Math.abs(e.clientX - this.startX);
      const dy = Math.abs(e.clientY - this.startY);

      if (!this.isDragging && (dx > this.opts.dragThreshold || dy > this.opts.dragThreshold)) {
        this.isDragging = true;
        this.opts.onDragStateChanged(true);
        if (this.selectDiv) this.selectDiv.style.display = 'block';
      }

      if (this.isDragging) {
        this.updateSelectDiv(this.startX, this.startY, e.clientX, e.clientY, modifier);
      }
    };

    this._onPointerUp = async (e: PointerEvent) => {
      if (e.button !== 0) return;

      const modifier = resolveModifier(e);

      if (!this.isDragging) {
        // Only intercept Shift (toggle) and Alt (subtract)
        // Ctrl (add) and plain click (replace) are handled by Highlighter's autoHighlightOnClick
        if (modifier === 'toggle' || modifier === 'subtract') {
          this.opts.onClickSelect(modifier);
        }
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      this.isDragging = false;
      if (this.selectDiv) this.selectDiv.style.display = 'none';
      setTimeout(() => this.opts.onDragStateChanged(false), 50);

      const windowMode = e.clientX >= this.startX;
      this.updateCursorIndicator('replace');

      await this.opts.onRectangleSelect(
        { x1: this.startX, y1: this.startY, x2: e.clientX, y2: e.clientY },
        windowMode,
        modifier,
      );
    };

    this._onMouseLeave = () => {
      if (this.isDragging) {
        this.isDragging = false;
        if (this.selectDiv) this.selectDiv.style.display = 'none';
        setTimeout(() => this.opts.onDragStateChanged(false), 50);
      }
      this.updateCursorIndicator('replace');
    };

    this._onWindowMouseMove = (e: MouseEvent) => {
      if (e.buttons & 1) return;
      this.updateCursorIndicator(resolveModifier(e), e.clientX, e.clientY);
    };

    this._onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.opts.onSelectionCleared();
      }
    };

    // Capture-phase pointer events so we run BEFORE the Highlighter's
    // bubble-phase pointerdown/pointerup handlers. This ensures onClickSelect
    // sets the pending modifier before the Highlighter processes the click.
    canvas.addEventListener('pointerdown', this._onPointerDown, { capture: true });
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('pointerup', this._onPointerUp, { capture: true });
    canvas.addEventListener('mouseleave', this._onMouseLeave);
    window.addEventListener('mousemove', this._onWindowMouseMove);
    window.addEventListener('keydown', this._onKeyDown);
  }

  private unbindEvents(): void {
    if (!this.canvas) return;
    if (this._onPointerDown) this.canvas.removeEventListener('pointerdown', this._onPointerDown, { capture: true });
    if (this._onMouseMove) this.canvas.removeEventListener('mousemove', this._onMouseMove);
    if (this._onPointerUp) this.canvas.removeEventListener('pointerup', this._onPointerUp, { capture: true });
    if (this._onMouseLeave) this.canvas.removeEventListener('mouseleave', this._onMouseLeave);
    if (this._onWindowMouseMove) window.removeEventListener('mousemove', this._onWindowMouseMove);
    if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
    this._onPointerDown = null;
    this._onMouseMove = null;
    this._onPointerUp = null;
    this._onMouseLeave = null;
    this._onWindowMouseMove = null;
    this._onKeyDown = null;
  }
}
