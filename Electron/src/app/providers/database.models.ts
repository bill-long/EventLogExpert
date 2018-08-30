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
