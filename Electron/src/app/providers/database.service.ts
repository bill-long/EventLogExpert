import { Injectable } from '@angular/core';
import { AppConfig } from '../../environments/environment';
import { ElectronService } from './electron.service';
import { from } from 'rxjs';
import { Message } from './database.models';

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
 * tags - we need to store tags separate for performance, since it is far
 *  too slow to look up all the unique tags from the messages store, so
 *  we store those here.
 */
export class DatabaseService {

  db: IDBDatabase;
  tagsCache: string[];

  constructor(private electronService: ElectronService) {
    const openReq = indexedDB.open(DATABASE_NAME, 1);
    openReq.onerror = (ev) => {
      console.log(`Failed to open ${DATABASE_NAME}`, ev);
    };

    openReq.onsuccess = async (ev: any) => {
      this.db = ev.target.result;
      this.tagsCache = await this.getAllTags();
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
   * @param messages The messages to add. Note the tag must be the same on all of them.
   */
  addMessages(messages: any[]) {
    return new Promise<number>(async resolve => {
      if (this.tagsCache.indexOf(messages[0].Tag) < 0) {
        const addTagResult = await this.addTag({ name: messages[0].Tag });
        if (addTagResult === null) {
          console.log('Failed to add tag:', messages[0].Tag);
          resolve(0);
        }

        this.tagsCache.push(messages[0].Tag);
      }

      let itemsAdded = 0;
      const transaction = this.db.transaction(MESSAGES_OBJECTSTORE_NAME, 'readwrite');
      transaction.oncomplete = ev => resolve(itemsAdded);
      transaction.onerror = ev => resolve(itemsAdded);
      const messageStore = transaction.objectStore(MESSAGES_OBJECTSTORE_NAME);
      messages.forEach(m => {
        messageStore.add(m);
        itemsAdded++;
      });
    });
  }

  addMessages$(messages: any[]) {
    return from(this.addMessages(messages));
  }

  addTag(tag: { name: string }) {
    return new Promise<string>(resolve => {
      const transaction = this.db.transaction(TAGS_OBJECTSTORE_NAME, 'readwrite');
      transaction.oncomplete = ev => resolve(tag.name);
      transaction.onerror = ev => resolve(null);
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

  getAllMessages$() {
    return from(this.getAllMessages());
  }

  getAllTags() {
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
  private getMessages(providerName: string, id: number, useRawId: boolean): Promise<Message[]> {
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
              const shortIdResult = await this.getMessages(providerName, id, false);
              shortIdResult.forEach(s => results.push(s));
            }

            if (!AppConfig.production) {
              const end = performance.now();
              console.log('getMessages finished', end - start, providerName, id, useRawId, results);
            }

            resolve(results);
          }
        };
    });
  }
}
