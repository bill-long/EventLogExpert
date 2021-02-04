import { EventRecord } from './eventlog.models';
import { EventLogService } from './eventlog.service';
import { AppConfig } from '../../../environments/environment';
import { Action, EventsLoadedAction, FilterEventsAction, FilterEventsFinishedAction, FinishedLoadingAction, FocusEventAction, LoadActiveLogAction, LoadLogFromFileAction, SelectEventAction, ShiftSelectEventAction } from './eventlog.actions';

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
    description: { text: string, negate: boolean, includeXml: boolean };
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

// Reducer

export const reducer = (state: State, action: Action): State => {
    if (!AppConfig.production) {
        console.log(action);
    }
    switch (action.type) {
        case 'CLEAR_EVENTS': {
            return {
                loading: false,
                name: state.name,
                records: [],
                recordsFiltered: [],
                focusedEvent: null,
                selectedEvents: null,
                filter: state.filter,
                sort: state.sort,
                uniqueRecordValues: { id: new Set<number>(), providerName: new Set<string>(), taskName: new Set<string>(['None']) }
            };
        }
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
                recordsFiltered: state.recordsFiltered,
                focusedEvent: state.focusedEvent,
                selectedEvents: state.selectedEvents,
                filter: thisAction.f,
                sort: state.sort,
                uniqueRecordValues: state.uniqueRecordValues
            };
        }
        case 'FILTER_EVENTS_FINISHED': {
            const thisAction = action as FilterEventsFinishedAction;
            return {
                loading: state.loading,
                name: state.name,
                records: state.records,
                recordsFiltered: thisAction.filteredRecords,
                focusedEvent: state.focusedEvent,
                selectedEvents: state.selectedEvents,
                filter: thisAction.f,
                sort: state.sort,
                uniqueRecordValues: state.uniqueRecordValues
            };
        }
        case 'FINISHED_LOADING': {
            const thisAction = action as FinishedLoadingAction;
            const ids = new Set<number>(state.uniqueRecordValues.id);
            const providers = new Set<string>(state.uniqueRecordValues.providerName);
            const tasks = new Set<string>(state.uniqueRecordValues.taskName);
            for (let i = 0; i < state.records.length; i++) {
                const r = state.records[i];
                ids.add(r.Id);
                providers.add(r.ProviderName);
                tasks.add(r.TaskName);
            }

            let records = state.records;
            if (thisAction.reverseSort) {
                records = records.reverse();
            }

            return {
                loading: false,
                name: state.name,
                records: records,
                recordsFiltered: records,
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
        case 'CLEAR_FOCUSED_EVENT': {
            const thisAction = action as FocusEventAction;
            return {
                loading: state.loading,
                name: state.name,
                records: state.records,
                recordsFiltered: state.recordsFiltered,
                focusedEvent: null,
                selectedEvents: state.selectedEvents,
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

export const filterEvents = (r: EventRecord[], f: EventFilter, s: EventLogService) => {
    if (!f) { return r; }
    const func = getFilterFunction(f, s);
    return r.filter(func);
};

export const getEventXml = (r: EventRecord, s: EventLogService) => {
    if (!r) { return ''; }

    let xml = `<Event xmlns="http://schemas.microsoft.com/win/2004/08/events/event">\r\n` +
        `  <System>\r\n` +
        `    <Provider Name="${r.ProviderName}" />\r\n` +
        `    <EventID` + (r.Qualifiers ? ` Qualifiers="${r.Qualifiers}"` : ``) + `>${r.Id}</EventID>\r\n` +
        `    <Level>${r.Level}</Level>\r\n` +
        `    <Task>${r.Task}</Task>\r\n` +
        `    <Keywords>${r.Keywords ? r.Keywords.toString(16) : '0x0'}</Keywords>\r\n` +
        `    <TimeCreated SystemTime="${new Date(r.TimeCreated).toISOString()}" />\r\n` +
        `    <EventRecordID>${r.RecordId}</EventRecordID>\r\n` +
        `    <Channel>${r.LogName}</Channel>\r\n` +
        `    <Computer>${r.MachineName}</Computer>\r\n` +
        `  </System>\r\n` +
        `  <EventData>\r\n`;

    const template = s.getTemplate(r);
    if (template) {
        let index = -1;
        let propIndex = 0;
        while (-1 < (index = template.indexOf('name=', index + 1))) {
            if (-1 < index) {
                const nameStart = index + 6;
                const nameEnd = template.indexOf('"', nameStart);
                const name = template.slice(nameStart, nameEnd);
                xml += `    <${name}>${r.Properties[propIndex]}</${name}>\r\n`;
                propIndex++;
            }
        }
    } else {
        xml += r.Properties.map(p => `    <Data>${p}</Data>`).join('\r\n') + '\r\n';
    }

    xml += `  </EventData>\r\n` +
        `</Event>`;

    return xml;
};

export const getFilterFunction = (f: EventFilter, s: EventLogService) => {
    let regex: RegExp = null;
    if (f.description) {
        if (f.description.text.startsWith('/')) {
            const lastSlash = f.description.text.lastIndexOf('/');
            if (lastSlash > -1) {
                const exp = f.description.text.substring(1, lastSlash);
                const flags = f.description.text.substring(lastSlash + 1);
                regex = new RegExp(exp, flags);
            }
        }

        if (regex === null) {
            // If still null, then we couldn't parse it as a regex, so just match anything
            // that contains this string, ignoring case. To do that, escape any regex symbols.
            // See https://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
            const escapedRegexString = f.description.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            regex = new RegExp(escapedRegexString, 'i');
        }
    }
    const func = (record: EventRecord) => {
        if (f.ids && !f.ids.has(record.Id)) { return false; }
        if (f.sources && !f.sources.has(record.ProviderName)) { return false; }
        if (f.tasks && !f.tasks.has(record.TaskName)) { return false; }
        if (f.levels && !f.levels.has(record.LevelName)) { return false; }
        if (f.description) {
            const descriptionMatch = regex.test(record.Description);
            let xmlMatch = false;
            if (f.description.includeXml) {
                if (record.Xml === undefined) {
                    record.Xml = getEventXml(record, s);
                }

                xmlMatch = regex.test(record.Xml);
            }

            const result = descriptionMatch || xmlMatch;
            return f.description.negate ? !result : result;
        }

        return true;
    };

    return func;
};