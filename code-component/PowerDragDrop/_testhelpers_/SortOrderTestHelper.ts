import { ReOrderableItem } from '../CustomSortPositionStrategy';

export function createReOrderableItems(
    numberOfItems: number,
    config?: { setOriginalPosition?: boolean; sort?: 'asc' | 'desc' },
) {
    const items: ReOrderableItem[] = [];
    const options = { ...{ setOriginalPosition: true, sort: 'asc' }, ...config };

    for (let i = 1; i <= numberOfItems; i++) {
        items.push({
            ItemId: i.toString(),
            OriginalDropZoneId: '1',
            DropZoneId: '1',
            OriginalPosition: options.setOriginalPosition
                ? (options.sort === 'asc' ? i : numberOfItems - i + 1) * 100
                : undefined,
        });
    }
    return items;
}
let itemIdCounter = 0;

export function createReOrderableItemsInMultiplezones(config: { numberOfItems: number; zoneId: string }[]) {
    const items: ReOrderableItem[] = [];
    for (let i = 0; i < config.length; i++) {
        const itemConfig = config[i];
        for (let j = 0; j < itemConfig.numberOfItems; j++) {
            const itemId = `item-${itemIdCounter++}`;
            items.push({
                ItemId: itemId,
                OriginalDropZoneId: itemConfig.zoneId,
                DropZoneId: itemConfig.zoneId,
                OriginalPosition: j * 100,
            });
        }
    }
    return items;
}

export function insertNewItem(
    items: ReOrderableItem[],
    zoneId: string,
    position: number,
    originalPosition: number | undefined = undefined,
) {
    const newItem: ReOrderableItem = {
        ItemId: `item-${itemIdCounter++}`,
        OriginalDropZoneId: zoneId,
        DropZoneId: zoneId,
        OriginalPosition: originalPosition,
    };
    items.splice(position, 0, newItem);
}

export function moveItemsSameZone(items: ReOrderableItem[], from: number, to: number) {
    const item = items[from];
    items.splice(from, 1);
    items.splice(to, 0, item);
    item.HasMovedPosition = true;
    //item.OriginalPosition = undefined;
}

export function moveItemFoDifferentZone(items: ReOrderableItem[], from: number, to: number, newZoneId: string) {
    const item = items[from];
    item.OriginalDropZoneId = newZoneId;
    items.splice(from, 1);
    items.splice(to, 0, item);
    item.HasMovedPosition = true;
}
