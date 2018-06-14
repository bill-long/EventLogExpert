import { EventUtils } from './eventutils.service';
import { Subject, Observable, from, Observer } from 'rxjs';
import { scan, share, filter } from 'rxjs/operators';
import { Injectable, NgZone } from '@angular/core';
import { AppConfig } from '../../environments/environment';
import { ElectronService } from './electron.service';

@Injectable()
export class EventLogService {

    actions$: Subject<Action>;
    state$: Observable<State>;

    constructor(private eventUtils: EventUtils, private ngZone: NgZone, private electronSvc: ElectronService) {
        const initState: State = { loading: false, name: null, records: [] };
        this.actions$ = new Subject();
        this.state$ = this.actions$.pipe(scan(reducer, initState), share());

        if (!AppConfig.production) {
            this.state$.subscribe(s => console.log(s));
        }

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

                // Loop until there are no more results
                let results = await resultReader();
                while (results !== null) {
                    // Emit this set of results
                    o.next(results);

                    // Now grab the next batch
                    results = await resultReader();
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

export class LogLoadedAction {
    type = 'LOG_LOADED';

    constructor(public logName: string, public records: any[]) { }
}

export type Action =
    EventsLoadedAction |
    FinishedLoadingAction |
    LoadActiveLogAction |
    LoadLogFromFile |
    LogLoadedAction;

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
        case 'LOG_LOADED': {
            const thisAction = action as LogLoadedAction;
            return {
                loading: false,
                name: thisAction.logName,
                records: thisAction.records
            };
        }

        default: {
            return state;
        }
    }
};
