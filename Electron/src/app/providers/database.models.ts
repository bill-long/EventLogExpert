export interface Message {
    LogLink: string;
    ProviderName: string;
    RawId: number;
    ShortId: number;
    Tag: string;
    Template: string;
    Text: string;
}

export interface Tag {
    name: string;
}

export interface ProviderEvent {
    ProviderName: string;
    Tag: string;
    Id: number;
    Version: string;
    LogName: string;
    Level: number;
    Opcode: number;
    Task: number;
    Keywords: number[];
    Template: string;
    Description: string;
}

export interface ProviderValueName {
    ProviderName: string;
    Tag: string;
    Value: number;
    Name: string;
}