import { JSONSchema4 } from 'json-schema';

export interface CurrentItem {
    ItemId: string;
    DropZoneId: string;
    OriginalDropZoneId: string;
    Position: number;
    OriginalPosition: number;
    HasMovedZone: boolean;
    HasMovedPosition: boolean;
}

export const CurrentItemsSchema: JSONSchema4 = {
    type: 'array',
    items: {
        type: 'object',
        properties: {
            ItemId: {
                type: 'string',
            },
            DropZoneId: {
                type: 'string',
            },
            OriginalDropZoneId: {
                type: 'string',
            },
            Position: {
                type: 'number',
            },
            OriginalPosition: {
                type: 'number',
            },
            HasMovedZone: {
                type: 'boolean',
            },
            HasMovedPosition: {
                type: 'boolean',
            },
        },
    },
};
