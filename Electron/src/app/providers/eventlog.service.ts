import { EventUtils } from './eventutils.service';
import { Subject, Observable, from, Observer } from 'rxjs';
import { scan, share, filter } from 'rxjs/operators';
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

        console.log('DbService', dbService);
        this.messageCache = {};
        const initState: State = { loading: false, name: null, records: [] };
        this.actions$ = new Subject();
        this.state$ = this.actions$.pipe(scan(reducer, initState), share());

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
                this.actions$.next(new LoadLogFromFile(file));
            });

        // Side effects of certain actions
        this.actions$.pipe(filter(a => a instanceof LoadActiveLogAction)).subscribe((a: LoadActiveLogAction) => {
            this.loadActiveLog(a.logName, a.serverName);
        });

        this.actions$.pipe(filter(a => a instanceof LoadLogFromFile)).subscribe((a: LoadLogFromFile) => {
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

                const providerNames = {};
                const taskNames = { None: true };
                const ids = {};

                // Loop until there are no more results
                let records: EventRecord[] = await resultReader();
                while (records !== null) {
                    for (let i = 0; i < records.length; i++) {
                        const r = records[i];

                        // Add the id to unique ids
                        if (!ids[r.Id]) {
                            ids[r.Id] = true;
                        }

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

                        // Add provider to unique provider names
                        if (!providerNames[r.ProviderName]) {
                            providerNames[r.ProviderName] = true;
                        }

                        // Set the description string
                        const m = await this.getMessage(r.ProviderName, r.Id, r.LogName);
                        r.Description = this.formatDescription(r, m);

                        // Set the task string
                        if (r.Task) {
                            r.TaskName = await this.getMessage(r.ProviderName, r.Task, null);
                            // Add the task name to unique names
                            if (!taskNames[r.TaskName]) {
                                taskNames[r.TaskName] = true;
                            }
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
    records: any[];
}

// Actions

export class EventsLoadedAction {
    type = 'EVENTS_LOADED';

    constructor(public records: any[]) { }
}

export class FinishedLoadingAction {
    type = 'FINISHED_LOADING';

    constructor() { }
}

export class LoadActiveLogAction {
    type = 'LOAD_ACTIVE_LOG';

    constructor(public logName: string, public serverName: string) { }
}

export class LoadLogFromFile {
    type = 'LOAD_LOG_FROM_FILE';

    constructor(public file: string) { }
}

export type Action =
    EventsLoadedAction |
    FinishedLoadingAction |
    LoadActiveLogAction |
    LoadLogFromFile;

// Reducer

const reducer = (state: State, action: Action): State => {
    if (!AppConfig.production) {
        console.log(action);
    }
    switch (action.type) {
        case 'EVENTS_LOADED': {
            const thisAction = action as EventsLoadedAction;
            return {
                loading: true,
                name: state.name,
                records: [...state.records, ...thisAction.records]
            };
        }
        case 'FINISHED_LOADING': {
            return {
                loading: false,
                name: state.name,
                records: state.records.reverse()
            };
        }
        case 'LOAD_ACTIVE_LOG': {
            const thisAction = action as LoadActiveLogAction;
            return {
                loading: true,
                name: thisAction.logName,
                records: []
            };
        }
        case 'LOAD_LOG_FROM_FILE': {
            const thisAction = action as LoadLogFromFile;
            return {
                loading: true,
                name: thisAction.file,
                records: []
            };
        }
        default: {
            return state;
        }
    }
};
