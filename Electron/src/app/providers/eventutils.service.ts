import { ElectronService } from './electron.service';
import { Injectable } from '@angular/core';

@Injectable()
export class EventUtils {

    constructor(private electronSvc: ElectronService) { }

    getActiveEventLogReader = this.electronSvc.edge.func({
        assemblyFile: 'EventLogExpert.dll',
        typeName: 'EventLogExpert.EventReader',
        methodName: 'GetActiveEventLogReader'
    });

    getEventLogFileReader = this.electronSvc.edge.func({
        assemblyFile: 'EventLogExpert.dll',
        typeName: 'EventLogExpert.EventReader',
        methodName: 'GetEventLogFileReader'
    });
}
