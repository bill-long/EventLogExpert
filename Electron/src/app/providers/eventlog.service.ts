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
        const initState: State = { openEventLog: null };
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
        this.eventUtils.getActiveEventLogReader(
            { logName, serverName },
            async (err, result: { reader: any, count: number }) => { // Note we get both the reader and count here
                this.loadEventsFromReaderDelegate(result);           // And pass the whole thing
            });
    }

    loadLogFromFile(file: string) {
        // Get an event reader delegate
        this.eventUtils.getEventLogFileReader(
            { file },
            async (err, result: { reader: any, count: number }) => { // Note we get both the reader and count here
                this.loadEventsFromReaderDelegate(result);           // And pass the whole thing
            });
    }

    /**
     * Calls the delegate until there are no more events
     * and updates progress while doing so.
     */
    private loadEventsFromReaderDelegate(result: { reader: any, count: number }) {

        const reader = result.reader;
        const totalEvents = result.count;

        // Create an observable that will emit the events
        const resultObserver = Observable.create(async (o: Observer<any[]>) => {

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

                // Await a 1 millisecond timeout in order to allow the view
                // to render. It seems that if the zone flips to Stable and
                // then immediately back to Unstable when go to grab the
                // next set of results, the view gets no time to render in
                // between, so no records are visible until we are completely
                // done loading. To avoid that issue, we await here.
                await new Promise(resolve => setTimeout(resolve, 1));

                // Now grab the next batch
                results = await resultReader();
            }

            // Complete
            o.complete();
        });

        resultObserver.subscribe(r => this.ngZone.run(() => this.actions$.next(new EventsLoadedAction(r))));
    }
}

export interface EventLog {
    name: string;
    records: any[];
}

// State

export interface State {
    openEventLog: EventLog;
}

// Actions

export class EventsLoadedAction {
    type = 'EVENTS_LOADED';

    constructor(public records: any[]) { }
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
    LoadActiveLogAction |
    LoadLogFromFile |
    LogLoadedAction;

// Reducer

const reducer = (state: State, action: Action): State => {
    switch (action.type) {
        case 'EVENTS_LOADED': {
            const thisAction = action as EventsLoadedAction;
            return {
                openEventLog: { name: state.openEventLog.name, records: [...state.openEventLog.records, ...thisAction.records] }
            };
        }
        case 'LOAD_ACTIVE_LOG': {
            const thisAction = action as LoadActiveLogAction;
            return {
                openEventLog: { name: thisAction.logName, records: [] }
            };
        }
        case 'LOAD_LOG_FROM_FILE': {
            const thisAction = action as LoadLogFromFile;
            return {
                openEventLog: { name: thisAction.file, records: [] }
            };
        }
        case 'LOG_LOADED': {
            const thisAction = action as LogLoadedAction;
            return {
                openEventLog: { name: thisAction.logName, records: thisAction.records }
            };
        }

        default: {
            return state;
        }
    }
};
