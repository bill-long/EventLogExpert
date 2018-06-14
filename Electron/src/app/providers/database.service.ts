import { Injectable } from '@angular/core';
import { ElectronService } from './electron.service';
import { from } from 'rxjs';

const DATABASE_NAME = 'messagesDb';
const OBJECTSTORE_NAME = 'messages';
const RAWID_INDEX = 'RawId, ProviderName';
const SHORTID_INDEX = 'ShortId, ProviderName';
const TAG_INDEX = 'Tag';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {

  db: IDBDatabase;

  constructor(private electronService: ElectronService) {
    const openReq = indexedDB.open(DATABASE_NAME, 1);
    openReq.onerror = (ev) => {
      console.log(`Failed to open ${DATABASE_NAME}`, ev);
    };

    openReq.onsuccess = (ev: any) => {
      this.db = ev.target.result;
    };

    openReq.onupgradeneeded = (ev: any) => {
      this.db = ev.target.result;
      let objectStore;
      if (ev.oldVersion < 1) {
        objectStore = this.db.createObjectStore(OBJECTSTORE_NAME, { autoIncrement: true });
      } else {
        objectStore = ev.target.transaction.objectStore(OBJECTSTORE_NAME);
      }

      objectStore.createIndex(RAWID_INDEX, ['RawId', 'ProviderName'], { unique: false });
      objectStore.createIndex(SHORTID_INDEX, ['ShortId', 'ProviderName'], { unique: false });
      objectStore.createIndex(TAG_INDEX, ['Tag'], { unique: false });
    };
  }

  addMessages(messages: any[]) {
    return new Promise<number>(resolve => {
      let itemsAdded = 0;
      const transaction = this.db.transaction(OBJECTSTORE_NAME, 'readwrite');
      transaction.oncomplete = ev => resolve(itemsAdded);
      transaction.onerror = ev => resolve(itemsAdded);
      const messageStore = transaction.objectStore(OBJECTSTORE_NAME);
      messages.forEach(m => {
        const req = messageStore.add(m);
        itemsAdded++;
      });
    });
  }

  addMessages$(messages: any[]) {
    return from(this.addMessages(messages));
  }

  getAllMessages() {
    return new Promise<any[]>(resolve => {
      const messages = [];
      this.db.transaction(OBJECTSTORE_NAME).objectStore(OBJECTSTORE_NAME).openCursor().onsuccess = (ev: any) => {
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

  getAllMessages$() {
    return from(this.getAllMessages());
  }

  getAllTags() {
    return new Promise<string[]>(resolve => {
      const tags = [];
      this.db.transaction(OBJECTSTORE_NAME)
        .objectStore(OBJECTSTORE_NAME)
        .index(TAG_INDEX)
        .openKeyCursor(null, 'nextunique')
        .onsuccess = (ev: any) => {
          const cursor = ev.target.result;
          if (cursor) {
            tags.push(cursor.key[0]);
            cursor.continue();
          } else {
            resolve(tags);
          }
        };
    });
  }

  deleteAllMessages() {
    return new Promise(resolve => {
      this.db.transaction(OBJECTSTORE_NAME, 'readwrite')
        .objectStore(OBJECTSTORE_NAME)
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
  findMessages(providerName: string, id: number) {
    return this.getMessages(providerName, id, true);
  }

  findMessages$(providerName: string, id: number) {
    return from(this.findMessages(providerName, id));
  }

  /**
   * Private method to do the actual work of searching, first
   * on raw ID and then on short ID.
   * @param providerName The name of the event provider
   * @param id The RawID of the event
   * @param useRawId Whether we should try to match on RawId or ShortId
   */
  private getMessages(providerName: string, id: number, useRawId: boolean) {
    return new Promise<any[]>(resolve => {
      const range = IDBKeyRange.only([id, providerName]);
      const results = [];
      const index = this.db.transaction(OBJECTSTORE_NAME)
        .objectStore(OBJECTSTORE_NAME)
        .index(useRawId ? RAWID_INDEX : SHORTID_INDEX)
        .openCursor(range)
        .onsuccess = (ev: any) => {
          const cursor = ev.target.result;
          if (cursor) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            if (results.length < 1 && useRawId) {
              this.getMessages(providerName, id, false).then(shortIdResult => resolve(shortIdResult));
            } else {
              resolve(results);
            }
          }
        };
    });
  }
}
