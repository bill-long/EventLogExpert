export interface EventRecord {
    LogName: string;
    ProviderName: string;
    TimeCreated: Date;
    Id: number;
    Version: string;
    Qualifiers: number;
    MachineName: string;
    Level: string;
    Task: number;
    Keywords: number[];
    User: string;
    Opcode: number;
    RecordId: number;
    Properties: string[];

    Description: string;
    KeywordNames: string;
    TaskName: string;
    LevelName: string;
    OpcodeName: string;
    TimeCreatedString: string;
    Xml: string;

    isFocused: boolean;
}
