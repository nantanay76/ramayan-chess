export interface Candidate {
  /** UCI move, e.g. "e2e4" or "e7e8q". */
  move: string;
  /** Score in centipawns from the side-to-move's perspective; mates mapped to ±~100000. */
  score: number;
}

export interface SearchResult {
  bestmove: string;
  candidates: Candidate[];
}

type LineListener = (line: string) => void;

/** The single-threaded lite build — the safe default, needs no special headers. */
export const SINGLE_THREAD_ENGINE = 'stockfish-18-lite-single.js';
/** The multi-threaded lite build — needs cross-origin isolation (SharedArrayBuffer). */
export const MULTI_THREAD_ENGINE = 'stockfish-18-lite.js';

/** Minimal UCI driver for a Stockfish Web Worker. */
export class UciEngine {
  private worker: Worker | null = null;
  private listeners = new Set<LineListener>();
  private initPromise: Promise<void> | null = null;
  /** Serialises searches on this worker — UCI is one `go`…`bestmove` at a time,
   *  so overlapping searches would interleave `info` lines and corrupt both. */
  private queue: Promise<unknown> = Promise.resolve();

  private file: string;

  constructor(file: string = SINGLE_THREAD_ENGINE) {
    this.file = file;
  }

  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        this.worker = new Worker(`${import.meta.env.BASE_URL}stockfish/${this.file}`);
        this.worker.onmessage = (e: MessageEvent) => {
          const line = typeof e.data === 'string' ? e.data : '';
          for (const listener of [...this.listeners]) listener(line);
        };
        this.send('uci');
        await this.waitFor((l) => l === 'uciok', 20000);
        await this.isReady();
      })();
    }
    return this.initPromise;
  }

  send(cmd: string): void {
    this.worker?.postMessage(cmd);
  }

  stop(): void {
    this.send('stop');
  }

  /** Tear down the worker so a fresh one can be built (e.g. switching binaries). */
  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.initPromise = null;
    this.listeners.clear();
    this.queue = Promise.resolve();
  }

  async isReady(): Promise<void> {
    this.send('isready');
    await this.waitFor((l) => l === 'readyok');
  }

  async setOptions(options: Record<string, string | number | boolean>): Promise<void> {
    for (const [name, value] of Object.entries(options)) {
      this.send(`setoption name ${name} value ${value}`);
    }
    await this.isReady();
  }

  async newGame(): Promise<void> {
    this.send('ucinewgame');
    await this.isReady();
  }

  private waitFor(pred: (line: string) => boolean, timeoutMs = 30000): Promise<string> {
    return new Promise((resolve, reject) => {
      const listener: LineListener = (line) => {
        if (pred(line)) {
          clearTimeout(timer);
          this.listeners.delete(listener);
          resolve(line);
        }
      };
      const timer = setTimeout(() => {
        this.listeners.delete(listener);
        reject(new Error('Engine timed out'));
      }, timeoutMs);
      this.listeners.add(listener);
    });
  }

  /**
   * Run a search and collect the deepest info line per MultiPV slot so weak
   * levels can choose among ranked candidate moves. Serialised per worker.
   */
  search(fen: string, go: string): Promise<SearchResult> {
    const task = () => this.runSearch(fen, go);
    const result = this.queue.then(task, task);
    // keep the chain alive whether or not an individual search rejects
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  private async runSearch(fen: string, go: string): Promise<SearchResult> {
    const byMultipv = new Map<number, { depth: number; move: string; score: number }>();

    const infoListener: LineListener = (line) => {
      if (!line.startsWith('info ') || !line.includes(' pv ')) return;
      const depth = /\bdepth (\d+)/.exec(line);
      const mpv = /\bmultipv (\d+)/.exec(line);
      const score = /\bscore (cp|mate) (-?\d+)/.exec(line);
      const pv = /\bpv ([a-h][1-8][a-h][1-8][qrbn]?)/.exec(line);
      if (!depth || !score || !pv) return;
      const slot = mpv ? parseInt(mpv[1], 10) : 1;
      const d = parseInt(depth[1], 10);
      const prev = byMultipv.get(slot);
      if (prev && prev.depth > d) return;
      const raw = parseInt(score[2], 10);
      const value = score[1] === 'mate' ? (raw > 0 ? 100000 - raw : -100000 - raw) : raw;
      byMultipv.set(slot, { depth: d, move: pv[1], score: value });
    };

    this.listeners.add(infoListener);
    try {
      this.send(`position fen ${fen}`);
      this.send(`go ${go}`);
      const bmLine = await this.waitFor((l) => l.startsWith('bestmove'), 120000);
      const bestmove = bmLine.split(/\s+/)[1];
      const candidates = [...byMultipv.values()]
        .map(({ move, score }) => ({ move, score }))
        .sort((a, b) => b.score - a.score);
      return { bestmove, candidates };
    } finally {
      this.listeners.delete(infoListener);
    }
  }
}
