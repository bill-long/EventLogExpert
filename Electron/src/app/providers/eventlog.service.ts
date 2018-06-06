import { EventUtils } from './eventUtils';
import { Subject, Observable } from 'rxjs';
import { scan, share } from 'rxjs/operators';
import { Injectable, NgZone } from '@angular/core';

@Injectable()
export class EventLogService {

    actions$: Subject<Action>;
    state$: Observable<State>;

    constructor(private eventUtils: EventUtils, private ngZone: NgZone) {
        const initState: State = { openEventLogs: [] };
        this.actions$ = new Subject();
        this.state$ = this.actions$.pipe(scan(reducer, initState), share());
        this.state$.subscribe(s => console.log(s));
    }

    loadActiveLog(logName: string, serverName: string) {
        return this.eventUtils.readEventsMethod({ logName, serverName }, (err, result) => {
            this.ngZone.run(() =>
                this.actions$.next(new LogLoadedAction(logName, result))
            );
        });
    }
}

export interface EventLog {
    name: string;
    records: any[];
}

// State

export interface State {
    openEventLogs: EventLog[];
}

// Actions

export class LoadActiveLogAction {
    type = 'LOAD_ACTIVE_LOG';

    constructor(public logName: string, public serverName: string) { }
}

export class LogLoadedAction {
    type = 'LOG_LOADED';

    constructor(public logName: string, public records: any[]) { }
}

export type Action =
    LoadActiveLogAction |
    LogLoadedAction;

// Reducer

const reducer = (state: State, action: Action): State => {
    switch (action.type) {
        case 'LOG_LOADED': {
            const thisAction = action as LogLoadedAction;
            return {
                openEventLogs: [...state.openEventLogs, { name: thisAction.logName, records: thisAction.records }]
            };
        }

        default: {
            return state;
        }
    }
};
