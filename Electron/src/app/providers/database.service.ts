import { Injectable } from '@angular/core';
import { AppConfig } from '../../environments/environment';
import { ElectronService } from './electron.service';
import { from, Observable, Subject, Observer } from 'rxjs';
import { Message } from './database.models';
import { take, shareReplay } from 'rxjs/operators';

const DATABASE_NAME = 'messagesDb';
const MESSAGES_OBJECTSTORE_NAME = 'messages';
const TAGS_OBJECTSTORE_NAME = 'tags';
const RAWID_INDEX = 'RawId, ProviderName';
const SHORTID_INDEX = 'ShortId, ProviderName';
const TAG_INDEX = 'Tag';

@Injectable({
  providedIn: 'root'
})
/**
 * Exposes a simple API for interacting with the database where we store
 * the messages we have ingested from the various providers.
 *
 * Currently, we keep two object stores:
 *
 * messages - this stores the messages themselves, including things like
 *  event ID, provider name, and the user-supplied tag
 *
 * tags - we need to store tags separately for performance, since it is far
 *  too slow to look up all the unique tags from the messages store, so
 *  we store those here.
 */
export class DatabaseService {

  db: IDBDatabase;
  tagsCache: string[];
  tagsByPriority$: Observable<string[]>;
  private tagsByPrioritySubject = new Subject<string[]>();

  constructor(private electronService: ElectronService) {
    this.tagsByPriority$ = this.tagsByPrioritySubject.pipe(shareReplay(1));
    const openReq = indexedDB.open(DATABASE_NAME, 1);
    openReq.onerror = (ev) => {
      console.log(`Failed to open ${DATABASE_NAME}`, ev);
    };

    openReq.onsuccess = async (ev: any) => {
      this.db = ev.target.result;
      this.tagsCache = await this.getAllTags();
      const tagsByPriorityString = localStorage.getItem('tagsByPriority');
      if (tagsByPriorityString) {
        const storedTagPriority = JSON.parse(tagsByPriorityString);
        const merged = this.mergeTagPriority(storedTagPriority, this.tagsCache);
        this.tagsByPrioritySubject.next(merged);
      } else {
        this.tagsByPrioritySubject.next(this.tagsCache);
      }
    };

    openReq.onupgradeneeded = (ev: any) => {
      this.db = ev.target.result;
      let messagesObjectStore;
      if (ev.oldVersion < 1) {
        messagesObjectStore = this.db.createObjectStore(MESSAGES_OBJECTSTORE_NAME, { autoIncrement: true });
        this.db.createObjectStore(TAGS_OBJECTSTORE_NAME, { autoIncrement: true });
      } else {
        messagesObjectStore = ev.target.transaction.objectStore(MESSAGES_OBJECTSTORE_NAME);
      }

      messagesObjectStore.createIndex(RAWID_INDEX, ['RawId', 'ProviderName'], { unique: false });
      messagesObjectStore.createIndex(SHORTID_INDEX, ['ShortId', 'ProviderName'], { unique: false });
      messagesObjectStore.createIndex(TAG_INDEX, ['Tag'], { unique: false });
    };
  }

  /**
   * Add messages to the database.
   * @param messages The messages to add.
   */
  addMessages(messages: any[], reportProgress: (s: string) => any): Promise<number> {
    return new Promise<number>(async resolve => {
      const batchSize = 100000;
      let total = 0;
      for (let i = 0; i < messages.length; i += batchSize) {
        const added = await this.addOneBatchOfMessages(messages.slice(i, i + batchSize));
        total += added;
        if (reportProgress) {
          reportProgress(`${total} / ${messages.length}`);
        }
      }

      const uniqueTags = Array.from(new Set(messages.map(m => m.Tag)));
      for (let i = 0; i < uniqueTags.length; i++) {
        const t = uniqueTags[i];
        if (!this.tagsCache.includes(t)) {
          this.tagsCache.push(t);
          const addTagResult = await this.addTag({ name: t });
        }
      }

      resolve(total);
    });
  }

  addMessages$(messages: any[], reportProgress: (s: string) => any) {
    return from(this.addMessages(messages, reportProgress));
  }

  addOneBatchOfMessages(messages: any[]): Promise<number> {
    return new Promise<number>(async resolve => {
      let itemsAdded = 0;
      const transaction = this.db.transaction(MESSAGES_OBJECTSTORE_NAME, 'readwrite');
      transaction.oncomplete = ev => {
        resolve(itemsAdded);
      };
      transaction.onabort = err => {
        throw new Error('addOneBatchOfMessages abort: ' + transaction.error.message);
      };
      const messageStore = transaction.objectStore(MESSAGES_OBJECTSTORE_NAME);
      messages.forEach(m => {
        const r = messageStore.add(m);
        itemsAdded++;
      });
    });
  }

  addTag(tag: { name: string }): Promise<string> {
    return new Promise<string>(resolve => {
      const transaction = this.db.transaction(TAGS_OBJECTSTORE_NAME, 'readwrite');
      transaction.oncomplete = ev => {
        this.tagsCache.push(tag.name);
        this.tagsByPriority$.pipe(take(1)).subscribe(tags => {
          const newPriority = this.mergeTagPriority([...tags, tag.name], this.tagsCache);
          this.tagsByPrioritySubject.next(newPriority);
        });
        resolve(tag.name);
      };
      transaction.onerror = ev => {
        throw new Error('addTag error: ' + transaction.error.message);
      };
      transaction.onabort = ev => {
        throw new Error('addTag abort: ' + transaction.error.message);
      };
      const tagStore = transaction.objectStore(TAGS_OBJECTSTORE_NAME);
      const req = tagStore.add(tag);
    });
  }

  getAllMessages() {
    return new Promise<any[]>(resolve => {
      const messages = [];
      this.db.transaction(MESSAGES_OBJECTSTORE_NAME).objectStore(MESSAGES_OBJECTSTORE_NAME).openCursor().onsuccess = (ev: any) => {
        const cursor = ev.target.result;
        if (cursor) {
          messages.push(cursor.value);
          cursor.continue();
        } else {
          resolve(messages);
        }
      };
    });
  }

  getAllMessages$(): Observable<any[]> {
    return new Observable(o => {
      const maxBuffer = 1000;
      let buffer = [];
      this.db.transaction(MESSAGES_OBJECTSTORE_NAME).objectStore(MESSAGES_OBJECTSTORE_NAME).openCursor().onsuccess = (ev: any) => {
        const cursor = ev.target.result;
        if (cursor) {
          buffer.push(cursor.value);
          if (buffer.length === maxBuffer) {
            o.next(buffer);
            buffer = [];
          }
          cursor.continue();
        } else {
          if (buffer.length > 0) {
            o.next(buffer);
          }
          o.complete();
        }
      };
    });
  }

  getAllTags(): Promise<string[]> {
    return new Promise<string[]>(resolve => {
      const tags = [];
      this.db.transaction(TAGS_OBJECTSTORE_NAME)
        .objectStore(TAGS_OBJECTSTORE_NAME)
        .openCursor()
        .onsuccess = (ev: any) => {
          const cursor = ev.target.result;
          if (cursor) {
            tags.push(cursor.value.name);
            cursor.continue();
          } else {
            resolve(tags);
          }
        };
    });
  }

  deleteAllMessages() {
    return new Promise(resolve => {
      this.db.transaction(MESSAGES_OBJECTSTORE_NAME, 'readwrite')
        .objectStore(MESSAGES_OBJECTSTORE_NAME)
        .clear()
        .onsuccess = (ev) => resolve();
    });
  }

  deleteAllMessages$() {
    return from(this.deleteAllMessages());
  }

  /**
   * Search for an event by RawID. If we do not find an
   * event with the same RawID, we look for one with a
   * ShortID that matches the provided RawID.
   * @param providerName The name of the event provider
   * @param id The raw ID of event.
   */
  findMessages(providerName: string, id: number, logName: string): Promise<Message[]> {
    return this.getMessages(providerName, id, logName, true);
  }

  findMessages$(providerName: string, id: number, logName: string) {
    return from(this.findMessages(providerName, id, logName));
  }

  setTagPriority(tagsByPriority: string[]) {
    const newTagPriority = this.mergeTagPriority(tagsByPriority, this.tagsCache);
    this.tagsByPrioritySubject.next(newTagPriority);
  }

  /**
   * Private method to do the actual work of searching, first
   * on raw ID and then on short ID.
   * @param providerName The name of the event provider
   * @param id The RawID of the event
   * @param useRawId Whether we should try to match on RawId or ShortId
   */
  private getMessages(providerName: string, id: number, logName: string, useRawId: boolean): Promise<Message[]> {
    return new Promise<any[]>(resolve => {
      const start = performance.now();
      const range = IDBKeyRange.only([id, providerName]);
      const results: Message[] = [];
      this.db.transaction(MESSAGES_OBJECTSTORE_NAME)
        .objectStore(MESSAGES_OBJECTSTORE_NAME)
        .index(useRawId ? RAWID_INDEX : SHORTID_INDEX)
        .openCursor(range)
        .onsuccess = async (ev: any) => {
          const cursor = ev.target.result;
          if (cursor) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            if (results.length < 1 && useRawId) {
              const shortIdResult = await this.getMessages(providerName, id, logName, false);
              shortIdResult.forEach(s => results.push(s));
            }

            if (!AppConfig.production) {
              const end = performance.now();
              console.log('getMessages finished', end - start, providerName, id, useRawId, results);
            }

            // If a log name was provided...
            if (logName) {
              // Then return one with a matching log name if we can
              const logNameMatches = results.filter(r => r.LogLink === logName);
              if (logNameMatches.length > 0) {
                resolve(logNameMatches);
              } else {
                resolve(results);
              }
            } else {
              // If logName was not provided, then discard anything that has one
              const noLogName = results.filter(r => !r.LogLink);
              resolve(noLogName);
            }
          }
        };
    });
  }

  private mergeTagPriority(desiredPriority: string[], availableTags: string[]) {
    if (!desiredPriority || desiredPriority.length < 1) {
      return availableTags;
    }

    // we must not include tags that don't exist
    let newPriority = desiredPriority.filter(t => availableTags.includes(t));

    // we must include all available tags
    const notIncluded = availableTags.filter(t => !desiredPriority.includes(t));
    newPriority = [...newPriority, ...notIncluded];

    return newPriority;
  }
}
