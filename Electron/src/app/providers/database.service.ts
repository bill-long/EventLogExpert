import { Injectable, NgZone } from '@angular/core';
import { AppConfig } from '../../environments/environment';
import { ElectronService } from './electron.service';
import { from, Observable, Subject, Observer } from 'rxjs';
import { Message, Tag, ProviderValueName, ProviderEvent } from './database.models';
import { take, shareReplay } from 'rxjs/operators';
import Dexie from 'dexie';

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

  db = new MessageDatabase();
  tagsCache: string[];
  tagsByPriority$: Observable<string[]>;
  private tagsByPrioritySubject = new Subject<string[]>();

  constructor(private electronService: ElectronService, private ngZone: NgZone) {
    this.tagsByPriority$ = this.tagsByPrioritySubject.pipe(shareReplay(1));

    this.db.tags.toArray().then(t => {
      this.tagsCache = t.map(tag => tag.name);
      const tagsByPriorityString = localStorage.getItem('tagsByPriority');
      if (tagsByPriorityString) {
        const storedTagPriority = JSON.parse(tagsByPriorityString);
        const merged = this.mergeTagPriority(storedTagPriority, this.tagsCache);
        this.tagsByPrioritySubject.next(merged);
      } else {
        // Since we don't have any priority stored (probably first-time launch),
        // sort in descending alpha order, because we generally want Windows at
        // the top.
        this.tagsCache = this.tagsCache.sort((a, b) => b.localeCompare(a));
        this.tagsByPrioritySubject.next(this.tagsCache);
      }
    });
  }

  /**
   * Add messages to the database.
   * @param messages The messages to add.
   */
  async addMessages(messages: any[]): Promise<void> {
    await this.db.messages.bulkAdd(messages);
  }

  addMessages$(messages: any[]) {
    return from(this.addMessages(messages));
  }

  async addTag(tag: { name: string }): Promise<void> {
    if (this.tagsCache.find(t => t === tag.name)) {
      return;
    }
    this.tagsCache.push(tag.name);
    await this.db.tags.add(tag);
    this.tagsByPriority$.pipe(take(1)).subscribe(tags => {
      const newPriority = this.mergeTagPriority([...tags, tag.name], this.tagsCache);
      this.tagsByPrioritySubject.next(newPriority);
    });
  }

  deleteTag(tag: { name: string }): Promise<void> {
    let p = this.ngZone.runOutsideAngular(async () => {
      let keys = await this.db.messages.where({ Tag: tag.name }).primaryKeys();
      await this.db.messages.bulkDelete(keys);
      keys = await this.db.events.where({ Tag: tag.name }).primaryKeys();
      await this.db.keywords.bulkDelete(keys);
      keys = await this.db.opcodes.where({ Tag: tag.name }).primaryKeys();
      await this.db.tasks.bulkDelete(keys);
      keys = await this.db.tags.where({ name: tag.name }).primaryKeys();
      await this.db.tasks.bulkDelete(keys);
    }).then(() => {
      this.tagsCache = this.tagsCache.filter(t => t !== tag.name);
    });

    return p;
  }

  async addEvents(events: ProviderEvent[]) {
    await this.db.events.bulkAdd(events);
  }

  async addKeywords(keywords: ProviderValueName[]) {
    await this.db.keywords.bulkAdd(keywords);
  }

  async addOpcodes(opcodes: ProviderValueName[]) {
    await this.db.opcodes.bulkAdd(opcodes);
  }

  async addTasks(tasks: ProviderValueName[]) {
    await this.db.tasks.bulkAdd(tasks);
  }

  async getAllMessages() {
    return await this.db.messages.toArray();
  }

  getAllMessages$(): Observable<any[]> {
    return new Observable(o => {
      const maxBuffer = 1000;
      let buffer = [];
      this.db.messages.each((message, cursor) => {
        buffer.push(message);
        if (buffer.length === maxBuffer) {
          o.next(buffer);
          buffer = [];
        }
      }).then(() => {
        if (buffer.length > 0) {
          o.next(buffer);
        }
        o.complete();
      });
    });
  }

  async getAllTags(): Promise<string[]> {
    let tags = await this.db.tags.toArray();
    return tags.map(t => t.name);
  }

  async deleteAllMessages() {
    await this.db.messages.clear();
  }

  deleteAllMessages$() {
    return from(this.deleteAllMessages());
  }

  async findEvents(providerName: string, id: number, version: string, logName: string) {
    return await this.db.events.where({ ProviderName: providerName, Id: id, Version: version, LogName: logName }).toArray();
  }

  async findKeyword(providerName: string, value: number) {
    return await this.db.keywords.where({ ProviderName: providerName, Value: value }).toArray();
  }

  async findOpcode(providerName: string, value: number) {
    return await this.db.opcodes.where({ ProviderName: providerName, Value: value }).toArray();
  }

  async findTask(providerName: string, value: number) {
    return await this.db.tasks.where({ ProviderName: providerName, Value: value }).toArray();
  }

  findMessages$(providerName: string, id: number, logName: string) {
    return from(this.findMessages(providerName, id, logName));
  }

  /**
   * Search for an event by RawID. If we do not find an
   * event with the same RawID, we look for one with a
   * ShortID that matches the provided RawID.
   * @param providerName The name of the event provider
   * @param id The raw ID of event.
   * @param logName The logName if available.
   */
  async findMessages(providerName: string, id: number, logName: string): Promise<Message[]> {

    const start = AppConfig.production ? null : performance.now();

    providerName = providerName.toUpperCase();

    let results = await this.db.messages
      .where({ 'RawId': id, 'ProviderName': providerName })
      .toArray();

    if (results.length < 1) {
      results = await this.db.messages
        .where({ 'ShortId': id, 'ProviderName': providerName })
        .toArray();
    }

    if (!AppConfig.production) {
      const end = performance.now();
      console.log('getMessages finished', end - start, providerName, id, results);
    }

    // If a log name was provided...
    if (logName) {
      // Then return one with a matching log name if we can
      const logNameMatches = results.filter(r => r.LogLink === logName);
      if (logNameMatches.length > 0) {
        return logNameMatches;
      } else {
        return results;
      }
    } else {
      // If logName was not provided, then discard anything that has one
      const noLogNameResults = results.filter(r => !r.LogLink);
      return noLogNameResults;
    }
  }

  setTagPriority(tagsByPriority: string[]) {
    const newTagPriority = this.mergeTagPriority(tagsByPriority, this.tagsCache);
    this.tagsByPrioritySubject.next(newTagPriority);
    localStorage.setItem('tagsByPriority', JSON.stringify(newTagPriority));
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

class MessageDatabase extends Dexie {
  messages: Dexie.Table<Message, number>;
  tags: Dexie.Table<Tag, number>;
  events: Dexie.Table<ProviderEvent, number>;
  keywords: Dexie.Table<ProviderValueName, number>;
  opcodes: Dexie.Table<ProviderValueName, number>;
  tasks: Dexie.Table<ProviderValueName, number>;

  constructor() {
    super('messagesDb');
    this.version(1).stores({
      messages: '++, [RawId+ProviderName], [ShortId+ProviderName], Tag',
      tags: '++, name',
      events: '++, [ProviderName+Id+Version+LogName], Tag',
      keywords: '++, [ProviderName+Value], Tag',
      opcodes: '++, [ProviderName+Value], Tag',
      tasks: '++, [ProviderName+Value], Tag'
    });

    this.messages = this.table('messages');
    this.tags = this.table('tags');
    this.events = this.table('events');
    this.keywords = this.table('keywords');
    this.opcodes = this.table('opcodes');
    this.tasks = this.table('tasks');
  }
}