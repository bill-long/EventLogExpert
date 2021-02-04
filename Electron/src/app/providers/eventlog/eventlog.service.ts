import { EventUtils } from '../eventutils.service';
import { Subject, Observable, Observer } from 'rxjs';
import { scan, filter, shareReplay, take, withLatestFrom } from 'rxjs/operators';
import { Injectable, NgZone } from '@angular/core';
import { AppConfig } from '../../../environments/environment';
import { ElectronService } from '../electron.service';
import { DatabaseService } from '../database.service';
import { EventRecord } from './eventlog.models';
import { Message, ProviderValueName, ProviderEvent } from '../database.models';
import { Action, LoadActiveLogAction, ClearEventsAction, EventsLoadedAction, FilterEventsAction, FilterEventsFinishedAction, FinishedLoadingAction, LoadLogFromFileAction } from './eventlog.actions';
import { State, reducer, filterEvents } from './eventlog.state';

@Injectable()
export class EventLogService {

    actions$: Subject<Action>;
    state$: Observable<State>;
    messageCache: { [key: string]: { [key: string]: { [key: string]: Message } } };
    eventCache: { [key: string]: { [key: number]: { [key: string]: { [key: string]: ProviderEvent } } } };
    keywordCache: { [key: string]: { [key: number]: ProviderValueName } }
    opcodeCache: { [key: string]: { [key: number]: ProviderValueName } }
    taskCache: { [key: string]: { [key: number]: ProviderValueName } }
    formatRegexp = new RegExp(/%([0-9]+)/g);
    timeFormat: Intl.DateTimeFormat;

    constructor(private eventUtils: EventUtils, private ngZone: NgZone,
        private electronSvc: ElectronService, private dbService: DatabaseService) {

        if (!AppConfig.production) {
            console.log(dbService);
            console.log(this);
        }

        this.messageCache = {};
        this.eventCache = {};
        this.keywordCache = {};
        this.opcodeCache = {};
        this.taskCache = {};
        const initState: State = {
            loading: false,
            name: null,
            records: [],
            recordsFiltered: [],
            focusedEvent: null,
            selectedEvents: [],
            filter: null,
            sort: { property: 'RecordId', ascending: false },
            uniqueRecordValues: { id: new Set<number>(), providerName: new Set<string>(), taskName: new Set<string>(['None']) }
        };
        this.actions$ = new Subject();
        this.state$ = this.actions$.pipe(scan(reducer, initState), shareReplay(1));

        this.configureSideEffects();
    }

    configureSideEffects() {
        // Load active log when selected from menu
        this.actions$.pipe(filter(a => a instanceof LoadActiveLogAction)).subscribe((a: LoadActiveLogAction) => {
            this.loadActiveLog(a.logName, a.serverName);
        });

        // Load log file when selected from menu
        this.actions$.pipe(filter(a => a instanceof LoadLogFromFileAction)).subscribe((a: LoadLogFromFileAction) => {
            this.loadLogFromFile(a.file);
        });

        // Filter when someone fires a filter action
        this.actions$
            .pipe(filter(a => a instanceof FilterEventsAction), withLatestFrom(this.state$))
            .subscribe(([a, s]: [FilterEventsAction, State]) => {
                const r = filterEvents(s.records, a.f, this);
                this.actions$.next(new FilterEventsFinishedAction(r, a.f));
            });

        // Filter when a log finishes loading
        this.actions$
            .pipe(filter(a => a instanceof FinishedLoadingAction), withLatestFrom(this.state$))
            .subscribe(([a, s]: [FinishedLoadingAction, State]) => {
                const r = filterEvents(s.records, s.filter, this);
                this.actions$.next(new FilterEventsFinishedAction(r, s.filter));
            });

        // Whenever tags change, update text fields
        this.dbService.tagsByPriority$.pipe(withLatestFrom(this.state$)).subscribe(([t, s]) => {
            if (s.records.length > 0 && !s.loading) {
                this.updateTextProperties(t);
            }
        });

        // If tags changed while we were loading, update text fields when finished loading
        this.actions$.pipe(
            filter(a => a instanceof FinishedLoadingAction),
            withLatestFrom(this.dbService.tagsByPriority$)
        ).subscribe(([finishedLoadingAction, tagsByPriority]: [FinishedLoadingAction, string[]]) => {
            if (finishedLoadingAction.tagsByPriority.length === tagsByPriority.length) {
                let match = true;
                for (let i = 0; i < finishedLoadingAction.tagsByPriority.length; i++) {
                    if (finishedLoadingAction.tagsByPriority[i] !== tagsByPriority[i]) {
                        match = false;
                        break;
                    }
                }

                if (match) { return; }
            }

            this.updateTextProperties(tagsByPriority);
        });
    }

    getTemplate(r: EventRecord) {
        const cachedEvent = this.getFromCache(this.messageCache, r.ProviderName, r.Id, r.LogName);
        if (cachedEvent) { return cachedEvent.Template; }
        return null;
    }

    loadActiveLog(logName: string, serverName: string) {
        // Get an event reader delegate
        const delegate: any = this.eventUtils.getActiveEventLogReader({ logName, serverName }, true);
        this.loadEventsFromReaderDelegate(delegate);
    }

    loadLogFromFile(file: string) {
        // Get an event reader delegate
        const delegate: any = this.eventUtils.getEventLogFileReader({ file }, true);
        this.loadEventsFromReaderDelegate(delegate);
    }

    setTimeZone(tzName: string) {
        this.timeFormat = Intl.DateTimeFormat(navigator.language,
            { timeZone: tzName, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    }

    /**
     * Calls the delegate until there are no more events
     * and updates progress while doing so.
     */
    private loadEventsFromReaderDelegate(delegate: any) {
        this.dbService.tagsByPriority$.pipe(take(1)).subscribe(tagsByPriority => {
            const reader = delegate;

            // Create an observable that will emit the events
            const resultObserver: Observable<any[]> =
                Observable.create(async (o: Observer<any[]>) => {

                    // Wrap the reader delegate in a Promise
                    const resultReader = () => {
                        return new Promise<any[]>(resolve => {
                            reader(null, (readerError, events) => {
                                if (readerError) {
                                    console.log(readerError);
                                    resolve(null);
                                } else {
                                    resolve(events);
                                }
                            });
                        });
                    };

                    // Loop until there are no more results
                    let records: EventRecord[] = await resultReader();
                    while (records !== null) {

                        // Populate the level name here, since it doesn't change when
                        // tag priority changes
                        records.forEach(r => {
                            switch (r.Level) {
                                case '0':
                                    r.LevelName = 'Information';
                                    break;
                                case '2':
                                    r.LevelName = 'Error';
                                    break;
                                case '3':
                                    r.LevelName = 'Warning';
                                    break;
                                case '4':
                                    r.LevelName = 'Information';
                                    break;
                            }
                        });

                        // Populate the stuff affected by tag order
                        await this.populateTextProperties(records, tagsByPriority);

                        // Emit this set of results
                        o.next(records);

                        // Now grab the next batch
                        records = await resultReader();
                    }

                    // Complete
                    o.complete();
                });

            resultObserver.subscribe(
                r => this.ngZone.run(() => this.actions$.next(new EventsLoadedAction(r))),
                err => console.log(err),
                () => this.ngZone.run(() => this.actions$.next(new FinishedLoadingAction(true, tagsByPriority)))
            );
        });
    }

    private updateTextProperties(tagsByPriority: string[]) {
        this.state$.pipe(take(1)).subscribe(async s => {
            if (s.records.length < 1) { return; }
            this.actions$.next(new ClearEventsAction());
            for (let i = 0; i < s.records.length; i += 1000) {
                const batch = s.records.splice(i, 1000);
                await this.populateTextProperties(batch, tagsByPriority);
                this.actions$.next(new EventsLoadedAction(batch));
            }

            this.actions$.next(new FinishedLoadingAction(false, tagsByPriority));
        });
    }

    private async populateTextProperties(records: EventRecord[], tagsByPriority: string[]) {
        for (let i = 0; i < records.length; i++) {
            const r = records[i];

            // Set the description string
            // Try modern providers first
            let providerName = r.ProviderName.toUpperCase();
            let e: ProviderEvent;
            if (r.Version && r.LogName) {
                const start = AppConfig.production ? null : performance.now();
                e = await this.getEvent(providerName, r.Id, r.Version, r.LogName, tagsByPriority);
                if (e) {
                    // We found a modern event match, so fill in the rest
                    const k = await this.getKeywords(providerName, r.Keywords, tagsByPriority);
                    const o = await this.getOpcode(providerName, r.Opcode, tagsByPriority);
                    const t = await this.getTask(providerName, r.Task, tagsByPriority);

                    if (!AppConfig.production) {
                        const end = performance.now();
                        console.log('getEvent/getKeywords/getOpcode/getTask completed', end - start, providerName, r.Id);
                    }

                    r.Description = this.formatDescription(r, e.Description);
                    r.TaskName = t ? t.Name : '';
                    r.KeywordNames = k ? k.map(kw => kw ? kw.Name : '').join(', ') : '';
                    r.OpcodeName = o ? o.Name : '';
                }
            }

            if (!e) {
                const m = await this.getMessage(providerName, r.Id, r.LogName, tagsByPriority);
                r.Description = this.formatDescription(r, m);

                // Set the task string
                if (r.Task) {
                    if (r.Task != r.Id) {
                        r.TaskName = await this.getMessage(providerName, r.Task, null, tagsByPriority);
                    } else {
                        // If it's the same as the description Id, just set it to the number in parens.
                        // This happens for events like 1014 from DNS Client Events for some reason.
                        r.TaskName = `(${r.Task})`;
                    }
                } else {
                    r.TaskName = 'None';
                }

                // Set the Opcode string
                if (r.Opcode) {
                    r.OpcodeName = await this.getMessage(providerName, r.Opcode, null, tagsByPriority);
                } else {
                    r.OpcodeName = '';
                }
            }

            // Set the time string using the user-specified zone
            r.TimeCreatedString = this.timeFormat.format(r.TimeCreated);
        }
    }

    private async getEvent(providerName: string, id: number, version: string, logName: string, tagsByPriority: string[]): Promise<ProviderEvent> {
        let e = this.getFromCache(this.eventCache, providerName, id, version, logName) as ProviderEvent;
        if (e === undefined) {
            let events = await this.dbService.findEvents(providerName, id, version, logName);
            e = this.getFirstItemByPriority(events, tagsByPriority);
            this.eventCache[providerName][id][version][logName] = e;
        }

        return e;
    }

    private async getKeywords(providerName: string, values: number[] | number, tagsByPriority: string[]) {
        if (values == null || (values instanceof Array && values.length < 1)) {
            return null;
        }

        let results: ProviderValueName[] = [];

        // If we didn't get passed an array, make it one
        if (!(values instanceof Array)) {
            values = [values];
        }

        values.forEach(async v => {
            let k = this.getFromCache(this.keywordCache, providerName, v) as ProviderValueName;
            if (k === undefined) {
                let keywords = await this.dbService.findKeyword(providerName, v);
                k = this.getFirstItemByPriority(keywords, tagsByPriority);
                this.keywordCache[providerName][v] = k;
                results.push(k);
            }
        });

        return results;
    }

    private async getOpcode(providerName: string, value: number, tagsByPriority: string[]) {
        let o = this.getFromCache(this.opcodeCache, providerName, value) as ProviderValueName;
        if (o === undefined) {
            let opcodes = await this.dbService.findOpcode(providerName, value);
            o = this.getFirstItemByPriority(opcodes, tagsByPriority);
            this.opcodeCache[providerName][value] = o;
        }

        return o;
    }

    private async getTask(providerName: string, value: number, tagsByPriority: string[]) {
        let t = this.getFromCache(this.taskCache, providerName, value) as ProviderValueName;
        if (t === undefined) {
            let tasks = await this.dbService.findTask(providerName, value);
            t = this.getFirstItemByPriority(tasks, tagsByPriority);
            this.taskCache[providerName][value] = t;
        }

        return t;
    }

    private async getMessage(providerName: string, messageNumber: number, logName: string, tagsByPriority: string[]): Promise<string> {
        const messageFromCache = this.getFromCache(this.messageCache, providerName, messageNumber, logName);
        if (messageFromCache !== undefined) {
            return messageFromCache ? messageFromCache.Text : '';
        } else {
            const m = await this.dbService.findMessages(providerName, messageNumber, logName);
            if (m && m.length > 0) {
                if (m.length === 1) {
                    this.messageCache[providerName][messageNumber][logName] = m[0];
                    return m[0].Text;
                }
                for (let i = 0; i < tagsByPriority.length; i++) {
                    const messageByTag = m.find(message => message.Tag === tagsByPriority[i]);
                    if (messageByTag) {
                        this.messageCache[providerName][messageNumber][logName] = messageByTag;
                        return messageByTag.Text;
                    }
                }

                // If we get here, we didn't find any matching tag somehow? Just pick one and hope for the best
                this.messageCache[providerName][messageNumber][logName] = m[0];
                return m[0].Text;
            } else {
                // If we didn't find anything for this provider and ID, set null and return empty string
                this.messageCache[providerName][messageNumber][logName] = null;
                return '';
            }
        }
    }

    private getFirstItemByPriority(items: any[], tagsByPriority: string[]) {
        if (items == null || items.length === 0) {
            return null;
        }

        for (let i = 0; i < tagsByPriority.length; i++) {
            const item = items.find(item => item.Tag === tagsByPriority[i]);
            if (item) {
                return item;
            }
        }

        return null;
    }

    private getFromCache(cache: any, key1: string | number, key2: string | number, key3: string | number = undefined, key4: string | number = undefined) {
        // The cache object can be from two to four levels deep
        // Populate to the appropriate depth, then do the lookup
        if (cache[key1] === undefined) {
            cache[key1] = {};
        }

        if (key3 !== undefined && cache[key1][key2] === undefined) {
            cache[key1][key2] = {};
        }

        if (key4 !== undefined && cache[key1][key2][key3] === undefined) {
            cache[key1][key2][key3] = {};
        }

        let result = cache[key1][key2];
        if (key3 !== undefined) {
            result = result[key3];
        }

        if (key4 !== undefined) {
            result = result[key4];
        }

        return result;
    }

    private formatDescription(record: EventRecord, messageFormat: string): string {
        // If getMessage didn't find anything...
        if (messageFormat === '') {
            // And we have exactly one property
            if (record.Properties.length === 1) {
                // Return that property as the description. This is what certain EventRecords look like
                // when the entire description is a string literal, and there is no provider DLL needed.
                return record.Properties[0];
            } else {
                return 'The description for this event could not be found. The following information was included with the event:\n\n' +
                    record.Properties.join('\n');
            }
        }

        const matches = messageFormat.match(this.formatRegexp);
        if (!matches || matches.length < 1) {
            return messageFormat;
        }

        for (let i = 0; i < matches.length; i++) {
            const propIndexStr = matches[i].substr(1);
            const propIndex = parseInt(propIndexStr, 10) - 1;
            if (record.Properties.length > propIndex) {
                messageFormat = messageFormat.replace(matches[i], record.Properties[propIndex]);
            }
        }

        return messageFormat;
    }
}
