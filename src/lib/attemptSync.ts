import type { CompletedAttempt, PendingAttempt, PendingRepository, SaveState } from './attempts';
import { isTerminalSaveError } from './attempts';

export function createAttemptSync(options: {
  repository: PendingRepository;
  send: (attempt: CompletedAttempt) => Promise<string>;
  getUserId: () => string | null;
  onState: (id: string, state: SaveState) => void;
}) {
  let running: Promise<void> | null = null;
  const state = (item: PendingAttempt, value: SaveState) => {
    if (options.getUserId() === item.attempt.user_id) options.onState(item.attempt.id, value);
  };
  async function work() {
    const userId = options.getUserId();
    if (!userId) return;
    const processed = new Set<string>();
    while (options.getUserId() === userId) {
      const batch = (await options.repository.list(userId)).filter(item => !processed.has(item.attempt.id));
      if (!batch.length) return;
      for (const item of batch) {
        if (options.getUserId() !== userId) return;
        processed.add(item.attempt.id); state(item, 'saving');
        try {
          const savedId = await options.send(item.attempt);
          if (savedId !== item.attempt.id) throw new Error('Unexpected saved attempt identity.');
          await options.repository.remove(item.attempt.id);
          state(item, 'saved');
        } catch (error) {
          if (isTerminalSaveError(error)) {
            try { await options.repository.remove(item.attempt.id); state(item, 'discarded'); }
            catch { state(item, 'error'); }
          } else state(item, 'queued');
        }
      }
    }
  }
  const coordinator = {
    async enqueue(item: PendingAttempt) {
      try { await options.repository.put(item); }
      catch (error) { options.onState(item.attempt.id, 'error'); throw error; }
      options.onState(item.attempt.id, 'queued');
    },
    async drain() {
      if (!running) running = work().finally(() => { running = null; });
      return running;
    },
    async retry(id: string) {
      const owner = options.getUserId();
      if (!owner) return;
      if ((await options.repository.list(owner)).some(item => item.attempt.id === id)) await coordinator.drain();
    }
  };
  return coordinator;
}
