export interface EventRecord {
    LogName: string;
    ProviderName: string;
    TimeCreated: Date;
    Id: number;
    Qualifiers: number;
    MachineName: string;
    Level: string;
    Task: number;
    Keywords: number;
    User: string;
    Opcode: number;
    RecordId: number;
    Properties: string[];

    Description: string;
    TaskName: string;
    LevelName: string;
    OpcodeName: string;
    TimeCreatedString: string;

    isFocused: boolean;
}
