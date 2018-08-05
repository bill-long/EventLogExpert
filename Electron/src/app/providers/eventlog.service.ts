import { EventUtils } from './eventutils.service';
import { Subject, Observable, from, Observer } from 'rxjs';
import { scan, filter, shareReplay } from 'rxjs/operators';
import { Injectable, NgZone } from '@angular/core';
import { AppConfig } from '../../environments/environment';
import { ElectronService } from './electron.service';
import { DatabaseService } from './database.service';
import { EventRecord } from './eventlog.models';

@Injectable()
export class EventLogService {

    actions$: Subject<Action>;
    state$: Observable<State>;
    messageCache: {};
    formatRegexp = new RegExp(/%([0-9]+)/g);

    constructor(private eventUtils: EventUtils, private ngZone: NgZone,
        private electronSvc: ElectronService, private dbService: DatabaseService) {

        if (!AppConfig.production) {
            console.log(dbService);
            console.log(this);
        }

        this.messageCache = {};
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
        this.state$ = this.actions$.pipe(scan(reducer, initState), shareReplay());

        /*if (!AppConfig.production) {
            this.state$.subscribe(s => console.log(s));
        }*/

        // Listen for notifications from Main process
        electronSvc.ipcRenderer.on('openActiveLog',
            (ev, logName, serverName) => {
                this.actions$.next(new LoadActiveLogAction(logName, serverName));
            });

        electronSvc.ipcRenderer.on('openLogFromFile',
            (ev, file) => {
                this.actions$.next(new LoadLogFromFileAction(file));
            });

        // Side effects of certain actions
        this.actions$.pipe(filter(a => a instanceof LoadActiveLogAction)).subscribe((a: LoadActiveLogAction) => {
            this.loadActiveLog(a.logName, a.serverName);
        });

        this.actions$.pipe(filter(a => a instanceof LoadLogFromFileAction)).subscribe((a: LoadLogFromFileAction) => {
            this.loadLogFromFile(a.file);
        });
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

    /**
     * Calls the delegate until there are no more events
     * and updates progress while doing so.
     */
    private loadEventsFromReaderDelegate(delegate: any) {

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
                    for (let i = 0; i < records.length; i++) {
                        const r = records[i];

                        // Set the level string
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

                        // Set the description string
                        const m = await this.getMessage(r.ProviderName, r.Id, r.LogName);
                        r.Description = this.formatDescription(r, m);

                        // Set the task string
                        if (r.Task) {
                            r.TaskName = await this.getMessage(r.ProviderName, r.Task, null);
                        } else {
                            r.TaskName = 'None';
                        }

                        // Set the Opcode string
                        if (r.Opcode) {
                            r.OpcodeName = await this.getMessage(r.ProviderName, r.Opcode, null);
                        } else {
                            r.OpcodeName = '';
                        }
                    }

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
            () => this.ngZone.run(() => this.actions$.next(new FinishedLoadingAction()))
        );
    }

    private async getMessage(providerName: string, messageNumber: number, logName: string) {
        if (this.messageCache[providerName] === undefined) {
            this.messageCache[providerName] = {};
        }

        if (this.messageCache[providerName][messageNumber] === undefined) {
            this.messageCache[providerName][messageNumber] = {};
        }

        const messageFromCache = this.messageCache[providerName][messageNumber][logName];
        if (messageFromCache !== undefined) {
            return messageFromCache;
        } else {
            const m = await this.dbService.findMessages(providerName, messageNumber, logName);
            if (m && m.length > 0) {
                this.messageCache[providerName][messageNumber][logName] = m[0].Text;
                return m[0].Text;
            } else {
                this.messageCache[providerName][messageNumber][logName] = '';
                return '';
            }
        }
    }

    private formatDescription(record: EventRecord, messageFormat: string): string {
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

// State

export interface State {
    loading: boolean;
    name: string;
    records: EventRecord[];
    recordsFiltered: EventRecord[];
    focusedEvent: EventRecord;
    selectedEvents: EventRecord[];
    filter: EventFilter;
    sort: EventSort;
    uniqueRecordValues: UniqueRecordValues;
}

// Filter for filtering events

export interface EventFilter {
    ids: Set<number>;
    sources: Set<string>;
    tasks: Set<string>;
    levels: Set<string>;
    description: string;
}

// Sort for sorting events

export interface EventSort {
    property: string;
    ascending: boolean;
}

// For filter UI efficiency

export interface UniqueRecordValues {
    id: Set<number>;
    providerName: Set<string>;
    taskName: Set<string>;
}

// Actions

export class EventsLoadedAction {
    type = 'EVENTS_LOADED';

    constructor(public records: EventRecord[]) { }
}

export class FilterEventsAction {
    type = 'FILTER_EVENTS';

    constructor(public f: EventFilter) { }
}

export class FinishedLoadingAction {
    type = 'FINISHED_LOADING';

    constructor() { }
}

export class LoadActiveLogAction {
    type = 'LOAD_ACTIVE_LOG';

    constructor(public logName: string, public serverName: string) { }
}

export class LoadLogFromFileAction {
    type = 'LOAD_LOG_FROM_FILE';

    constructor(public file: string) { }
}

export class FocusEventAction {
    type = 'FOCUS_EVENT';

    constructor(public e: EventRecord) { }
}

export class SelectEventAction {
    type = 'SELECT_EVENT';

    constructor(public e: EventRecord) { }
}

export class ShiftSelectEventAction {
    type = 'SHIFT_SELECT_EVENT';

    constructor(public e: EventRecord) { }
}

export type Action =
    EventsLoadedAction |
    FilterEventsAction |
    FinishedLoadingAction |
    FocusEventAction |
    LoadActiveLogAction |
    LoadLogFromFileAction |
    SelectEventAction |
    ShiftSelectEventAction;

// Reducer

const reducer = (state: State, action: Action): State => {
    if (!AppConfig.production) {
        console.log(action);
    }
    switch (action.type) {
        case 'EVENTS_LOADED': {
            const thisAction = action as EventsLoadedAction;
            const records = [...state.records, ...thisAction.records];
            return {
                loading: true,
                name: state.name,
                records: records,
                recordsFiltered: records,
                focusedEvent: state.focusedEvent,
                selectedEvents: state.selectedEvents,
                filter: state.filter,
                sort: state.sort,
                uniqueRecordValues: state.uniqueRecordValues
            };
        }
        case 'FILTER_EVENTS': {
            const thisAction = action as FilterEventsAction;
            return {
                loading: state.loading,
                name: state.name,
                records: state.records,
                recordsFiltered: filterEvents(state.records, thisAction.f),
                focusedEvent: state.focusedEvent,
                selectedEvents: state.selectedEvents,
                filter: thisAction.f,
                sort: state.sort,
                uniqueRecordValues: state.uniqueRecordValues
            };
        }
        case 'FINISHED_LOADING': {
            const ids = new Set<number>(state.uniqueRecordValues.id);
            const providers = new Set<string>(state.uniqueRecordValues.providerName);
            const tasks = new Set<string>(state.uniqueRecordValues.taskName);
            for (let i = 0; i < state.records.length; i++) {
                const r = state.records[i];
                ids.add(r.Id);
                providers.add(r.ProviderName);
                tasks.add(r.TaskName);
            }

            const records = state.records.reverse();

            return {
                loading: false,
                name: state.name,
                records: records,
                recordsFiltered: filterEvents(records, state.filter),
                focusedEvent: state.focusedEvent,
                selectedEvents: state.selectedEvents,
                filter: state.filter,
                sort: { property: 'RecordId', ascending: false },    // this is the only supported sort for now
                uniqueRecordValues: {
                    id: new Set(Array.from(ids).sort((a, b) => a - b)),
                    providerName: new Set(Array.from(providers).sort()),
                    taskName: new Set(Array.from(tasks).sort())
                }
            };
        }
        case 'LOAD_ACTIVE_LOG': {
            const thisAction = action as LoadActiveLogAction;
            return {
                loading: true,
                name: thisAction.logName,
                records: [],
                recordsFiltered: [],
                focusedEvent: state.focusedEvent,
                selectedEvents: state.selectedEvents,
                filter: state.filter,
                sort: state.sort,
                uniqueRecordValues: state.uniqueRecordValues
            };
        }
        case 'LOAD_LOG_FROM_FILE': {
            const thisAction = action as LoadLogFromFileAction;
            return {
                loading: true,
                name: thisAction.file,
                records: [],
                recordsFiltered: [],
                focusedEvent: state.focusedEvent,
                selectedEvents: state.selectedEvents,
                filter: state.filter,
                sort: state.sort,
                uniqueRecordValues: state.uniqueRecordValues
            };
        }
        case 'FOCUS_EVENT': {
            const thisAction = action as FocusEventAction;
            return {
                loading: state.loading,
                name: state.name,
                records: state.records,
                recordsFiltered: state.recordsFiltered,
                focusedEvent: thisAction.e,
                selectedEvents: [thisAction.e],
                filter: state.filter,
                sort: state.sort,
                uniqueRecordValues: state.uniqueRecordValues
            };
        }
        case 'SELECT_EVENT': {
            const thisAction = action as SelectEventAction;
            const newSelectedEvents =
                state.selectedEvents.indexOf(thisAction.e) > -1 ?
                state.selectedEvents.filter(r => r !== thisAction.e) :
                [...state.selectedEvents, thisAction.e];
            return {
                loading: state.loading,
                name: state.name,
                records: state.records,
                recordsFiltered: state.recordsFiltered,
                focusedEvent: state.focusedEvent,
                selectedEvents: newSelectedEvents,
                filter: state.filter,
                sort: state.sort,
                uniqueRecordValues: state.uniqueRecordValues
            };
        }
        case 'SHIFT_SELECT_EVENT': {
            const thisAction = action as ShiftSelectEventAction;
            if (!state.focusedEvent) { return state; }
            const start = state.recordsFiltered.indexOf(state.focusedEvent);
            const end = state.recordsFiltered.indexOf(thisAction.e);
            if (start === end) { return state; }
            const newSelectedEvents = [state.focusedEvent];
            if (start > end) {
                for (let i = start - 1; i >= end; i--) {
                    newSelectedEvents.push(state.recordsFiltered[i]);
                }
            } else {
                for (let i = start + 1; i <= end; i++) {
                    newSelectedEvents.push(state.recordsFiltered[i]);
                }
            }

            return {
                loading: state.loading,
                name: state.name,
                records: state.records,
                recordsFiltered: state.recordsFiltered,
                focusedEvent: state.focusedEvent,
                selectedEvents: newSelectedEvents,
                filter: state.filter,
                sort: state.sort,
                uniqueRecordValues: state.uniqueRecordValues
            };
        }
        default: {
            return state;
        }
    }
};

const filterEvents = (r: EventRecord[], f: EventFilter) => {
    if (!f) { return r; }
    return r.filter(record => {
        if (f.ids && !f.ids.has(record.Id)) { return false; }
        if (f.sources && !f.sources.has(record.ProviderName)) { return false; }
        if (f.tasks && !f.tasks.has(record.TaskName)) { return false; }
        if (f.levels && !f.levels.has(record.LevelName)) { return false; }
        if (f.description) {
            if (record.Description.indexOf(f.description) < 0) {
                return false;
            }
        }

        return true;
    });
};
