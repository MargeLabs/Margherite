// Le journal 0004 côté application : lu par morceaux (seulement les entrées nouvelles), jamais écrit.
// Tant que la table n'existe pas (migration non passée), le statut est « absent » et le moteur reste en mode dégradé ;
// dès qu'elle existe, la bascule est automatique à la lecture suivante. Aucune interface n'en dépend.
import type { JournalRow } from './types';

export type JournalStatus = 'unknown' | 'absent' | 'ready';
/** Entrées de seq > `after`, dans l'ordre ; null = la table n'existe pas (ou n'est pas lisible). Lance une erreur si le réseau échoue. */
export type FetchAfter = (after: number) => Promise<JournalRow[] | null>;

/** Ce que le moteur voit du journal : les lignes quand il est prêt, null sinon, et une estampille qui change à chaque nouveauté. */
export interface JournalAccess {
  get(): JournalRow[] | null;
  stamp(): string;
}

export class JournalSource implements JournalAccess {
  private rows: JournalRow[] = [];
  private state: JournalStatus = 'unknown';
  private checkedAt = 0;
  private busy: Promise<void> | null = null;

  /** `retryAbsentMs` : pendant ce délai on ne redemande pas une table déjà trouvée absente (une requête de moins à chaque rechargement). */
  constructor(private readonly retryAbsentMs = 10 * 60_000, private readonly clock: () => number = Date.now) {}

  get status(): JournalStatus {
    return this.state;
  }
  get head(): number {
    return this.rows.reduce((m, r) => Math.max(m, r.seq), 0);
  }
  get(): JournalRow[] | null {
    return this.state === 'ready' ? this.rows : null;
  }
  stamp(): string {
    return `${this.state}:${this.rows.length}:${this.head}:${this.rows.at(-1)?.recorded_at ?? ''}`;
  }

  /** Ajoute les entrées nouvelles. Une panne réseau ne change rien (on garde ce qu'on a) ; elle est avalée : le moteur reste utilisable. */
  refresh(fetchAfter: FetchAfter): Promise<void> {
    if (this.busy) return this.busy;
    if (this.state === 'absent' && this.clock() - this.checkedAt < this.retryAbsentMs) return Promise.resolve();
    this.busy = (async () => {
      try {
        const rows = await fetchAfter(this.head);
        this.checkedAt = this.clock();
        if (rows === null) {
          this.rows = [];
          this.state = 'absent';
          return;
        }
        const known = this.head;
        const fresh = rows.filter((r) => r.seq > known).sort((a, b) => a.seq - b.seq);
        if (fresh.length) this.rows = [...this.rows, ...fresh];
        this.state = 'ready';
      } catch {
        // réseau : on garde l'état précédent
      } finally {
        this.busy = null;
      }
    })();
    return this.busy;
  }
}
