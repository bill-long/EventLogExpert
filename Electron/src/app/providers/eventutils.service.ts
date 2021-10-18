import { ElectronService } from './electron.service';
import { Injectable } from '@angular/core';
import { Message, ProviderEvent } from './database.models';
import { Func } from 'electron-edge-js';

@Injectable()
export class EventUtils {

    constructor(private electronSvc: ElectronService) { }

    getActiveEventLogReader = this.electronSvc.edge.func({
        assemblyFile: this.electronSvc.extraResourcesPath + './EventLogExpert.dll',
        typeName: 'EventLogExpert.EventReader',
        methodName: 'GetActiveEventLogReader'
    });

    getEventLogRecordCount = this.electronSvc.edge.func({
        assemblyFile: this.electronSvc.extraResourcesPath + './EventLogExpert.dll',
        typeName: 'EventLogExpert.EventReader',
        methodName: 'GetEventLogRecordCount'
    });

    getEventLogFileReader = this.electronSvc.edge.func({
        assemblyFile: this.electronSvc.extraResourcesPath + './EventLogExpert.dll',
        typeName: 'EventLogExpert.EventReader',
        methodName: 'GetEventLogFileReader'
    });

    getProviderNames = this.electronSvc.edge.func({
        assemblyFile: this.electronSvc.extraResourcesPath + './EventLogExpert.dll',
        typeName: 'EventLogExpert.ProviderReader',
        methodName: 'GetProviderNames'
    });

    loadProviderDetails: Func<{}, ProviderDetails> = this.electronSvc.edge.func({
        assemblyFile: this.electronSvc.extraResourcesPath + './EventLogExpert.dll',
        typeName: 'EventLogExpert.ProviderReader',
        methodName: 'LoadProviderDetails'
    });
}

export interface ProviderDetails {
    ProviderName: string;
    Messages: Message[];
    Events: ProviderEvent[];
    Keywords: { Value: number; Name: string }[];
    Opcodes: { Value: number; Name: string }[];
    Tasks: { Value: number; Name: string }[];
}
