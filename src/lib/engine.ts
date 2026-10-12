// Stockfish in a Web Worker, spoken to in UCI. One search at a time: jobs wait in a queue, and a newer request
// can stop the one running (its best line so far is still returned).

export interface Line {
  multipv: number;
  depth: number;
  /** centipawns from the side to move */
  cp?: number;
  /** moves to mate from the side to move: positive gives mate, negative is mated */
  mate?: number;
  pv: string[];
}

export interface Analysis {
  fen: string;
  bestmove: string | null;
  depth: number;
  /** best first */
  lines: Line[];
}

export interface SearchOptions {
  depth?: number;
  movetime?: number;
  multipv?: number;
}

interface Job {
  fen: string;
  opts: SearchOptions;
  resolve: (a: Analysis) => void;
  lines: Map<number, Line>;
  depth: number;
  started: boolean;
}

export type EngineState = 'loading' | 'ready' | 'failed';

export class Engine {
  private worker: Worker;
  private queue: Job[] = [];
  private current: Job | null = null;
  private multipv = 1;
  private waiters = new Map<string, () => void>();
  state: EngineState = 'loading';
  readonly ready: Promise<void>;
  /** download progress, 0..1, while the network file arrives */
  onProgress: ((share: number) => void) | null = null;

  constructor(url = '/engine/stockfish-19-lite-single.js') {
    this.worker = new Worker(url);
    this.worker.onmessage = (e: MessageEvent) => this.read(String(e.data));
    this.ready = new Promise<void>((resolve, reject) => {
      this.worker.onerror = (e) => {
        this.state = 'failed';
        reject(new Error(e.message || 'engine failed to load'));
      };
      this.expect('uciok').then(async () => {
        this.send('setoption name Hash value 16');
        this.send('isready');
        await this.expect('readyok');
        this.state = 'ready';
        resolve();
      });
    });
    this.send('setoption name CanOutputEngineDownloadProgress value true');
    this.send('uci');
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd);
  }

  private expect(token: string): Promise<void> {
    return new Promise((resolve) => this.waiters.set(token, resolve));
  }

  private read(line: string) {
    const waiter = this.waiters.get(line.trim());
    if (waiter) {
      this.waiters.delete(line.trim());
      waiter();
      return;
    }
    if (line.startsWith('info progress')) {
      const m = /progress (\d+(?:\.\d+)?)/.exec(line);
      if (m) this.onProgress?.(Math.min(1, Number(m[1]) / 100));
      return;
    }
    const job = this.current;
    if (!job) return;
    if (line.startsWith('info ') && line.includes(' pv ')) {
      if (/ (lowerbound|upperbound)/.test(line)) return;
      const depth = Number(/ depth (\d+)/.exec(line)?.[1] ?? 0);
      const multipv = Number(/ multipv (\d+)/.exec(line)?.[1] ?? 1);
      const cp = /score cp (-?\d+)/.exec(line);
      const mate = /score mate (-?\d+)/.exec(line);
      const pv = line.split(' pv ')[1].trim().split(/\s+/);
      job.lines.set(multipv, { multipv, depth, cp: cp ? Number(cp[1]) : undefined, mate: mate ? Number(mate[1]) : undefined, pv });
      if (multipv === 1) job.depth = depth;
      return;
    }
    if (line.startsWith('bestmove')) {
      const best = line.split(/\s+/)[1];
      this.current = null;
      const lines = [...job.lines.values()].sort((a, b) => a.multipv - b.multipv);
      job.resolve({ fen: job.fen, bestmove: best && best !== '(none)' ? best : null, depth: job.depth, lines });
      this.next();
    }
  }

  private next() {
    if (this.current || !this.queue.length) return;
    const job = this.queue.shift()!;
    this.current = job;
    job.started = true;
    const mpv = job.opts.multipv ?? 1;
    if (mpv !== this.multipv) {
      this.send(`setoption name MultiPV value ${mpv}`);
      this.multipv = mpv;
    }
    this.send(`position fen ${job.fen}`);
    const parts = ['go'];
    if (job.opts.depth) parts.push(`depth ${job.opts.depth}`);
    if (job.opts.movetime) parts.push(`movetime ${job.opts.movetime}`);
    if (parts.length === 1) parts.push('depth 12');
    this.send(parts.join(' '));
  }

  /** Search a position. Resolves with the best lines when the search ends or is stopped. */
  analyse(fen: string, opts: SearchOptions = {}): Promise<Analysis> {
    return new Promise((resolve) => {
      this.queue.push({ fen, opts, resolve, lines: new Map(), depth: 0, started: false });
      this.ready.then(() => this.next());
    });
  }

  /** End the running search early; it still resolves, with what it found so far. */
  stop() {
    if (this.current) this.send('stop');
  }

  /** Finish quickly: stop the running search and cut every waiting one to a short look. */
  hurry() {
    for (const job of this.queue) job.opts = { ...job.opts, depth: Math.min(job.opts.depth ?? 10, 10), movetime: 300 };
    this.stop();
  }

  /** Drop every waiting search (they resolve empty) and stop the running one. */
  cancelAll() {
    for (const job of this.queue.splice(0)) job.resolve({ fen: job.fen, bestmove: null, depth: 0, lines: [] });
    this.stop();
  }

  /** Is a search running or waiting? */
  get busy() {
    return !!this.current || this.queue.length > 0;
  }

  newGame() {
    this.cancelAll();
    this.ready.then(() => this.send('ucinewgame'));
  }

  dispose() {
    this.cancelAll();
    this.worker.terminate();
  }
}
