import { EventRecord } from './eventlog.models';
import { EventFilter } from './eventlog.state';

export class ClearEventsAction {
    type = 'CLEAR_EVENTS';

    constructor() { }
}

export class EventsLoadedAction {
    type = 'EVENTS_LOADED';

    constructor(public records: EventRecord[]) { }
}

export class FilterEventsAction {
    type = 'FILTER_EVENTS';

    constructor(public f: EventFilter) { }
}

export class FilterEventsFinishedAction {
    type = 'FILTER_EVENTS_FINISHED';

    constructor(public filteredRecords: EventRecord[], public f: EventFilter) { }
}

export class FinishedLoadingAction {
    type = 'FINISHED_LOADING';

    /**
     * Constructor for FinishedLoadingAction.
     * @param reverseSort Whether to reverse the order of records. Should be true when loading from evtx.
     * @param tagsByPriority The tag order used during loading, so we can determine if it changed.
     */
    constructor(public reverseSort: boolean, public tagsByPriority: string[]) { }
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

export class ClearFocusedEventAction {
    type = 'CLEAR_FOCUSED_EVENT';

    constructor() { }
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
    ClearEventsAction |
    EventsLoadedAction |
    FilterEventsAction |
    FilterEventsFinishedAction |
    FinishedLoadingAction |
    FocusEventAction |
    ClearFocusedEventAction |
    LoadActiveLogAction |
    LoadLogFromFileAction |
    SelectEventAction |
    ShiftSelectEventAction;
