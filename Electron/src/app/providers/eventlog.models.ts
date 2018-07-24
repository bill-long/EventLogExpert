export interface EventRecord {
    LogName: string;
    ProviderName: string;
    TimeCreated: string;
    Id: number;
    MachineName: string;
    Level: string;
    Task: number;
    Keywords: any;
    User: string;
    Opcode: number;
    RecordId: number;
    Properties: string[];

    Description: string;
    TaskName: string;
    LevelName: string;
    OpcodeName: string;

    isFocused: boolean;
}
