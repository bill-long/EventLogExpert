import { ElectronService } from './electron.service';
import { Injectable } from '@angular/core';

@Injectable()
export class EventUtils {

    constructor(private electronSvc: ElectronService) { }

    readEventsMethod = this.electronSvc.edge.func({
        assemblyFile: 'EventLogExpert.dll',
        typeName: 'EventLogExpert.EventUtils',
        methodName: 'ReadEvents'
    });
}
