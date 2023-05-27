/* 
This objective of this sorting algorithm is to allow cards to be moved and result in the minimum number of updates
E.g. if a card is moved between to cards, the other cards should not be updated
only the moved card should be updated to be half the distance between the two cards

It is used when the 'Custom Sort Order' is selected on the control, and an attribute
is provided that holds the sort position value
*/

import { CurrentItem } from './CurrentItemSchema';

// Only the ItemId, OriginalDropZoneId & DropZoneId are required to re-order and detect changes
export type ReOrderableItem = Pick<CurrentItem, 'ItemId' | 'OriginalDropZoneId' | 'DropZoneId'> &
    Partial<Pick<CurrentItem, 'Position' | 'OriginalPosition' | 'HasMovedZone' | 'HasMovedPosition'>>;

export interface CustomSortPositionsOptions {
    // The direction that custom positions are sorted to establish if they are in sequence or not
    sortOrder: 'asc' | 'desc';
    // The amount items will be incremented by if there is space
    positionIncrement: number;
    // Allow custom sort positions to be negative when moving items below items that have a position less than the increment
    allowNegative: boolean;
    // Round to nearest integer - if true this will mean that multiple items can have the same position
    maxDecimalPlaces: number;
    // The minimum increment that will be used when ordering items. Below this, then positionIncrement/10 will be used
    minimumIncrement?: number;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export function updateSortPosition(items: Partial<ReOrderableItem>[], options?: Partial<CustomSortPositionsOptions>) {
    const defaultOptions: CustomSortPositionsOptions = {
        positionIncrement: 100,
        sortOrder: 'asc',
        allowNegative: false,
        maxDecimalPlaces: 4,
    };
    const config = { ...defaultOptions, ...options } as CustomSortPositionsOptions;
    const sortDirectionMultipler = config.sortOrder === 'asc' ? 1 : -1;
    const increment = config.positionIncrement * sortDirectionMultipler;
    let maxPosition = 0;
    if (config.sortOrder === 'desc') {
        // find the item where the next original sequence is lower
        const firstDecreasingItem = items.find((item, index) => {
            if (index === items.length - 1) {
                return false; // skip last item
            }
            return (item.OriginalPosition ?? 0) > (items[index + 1].OriginalPosition ?? 0);
        });

        maxPosition = firstDecreasingItem?.OriginalPosition
            ? firstDecreasingItem.OriginalPosition + config.positionIncrement * (items.indexOf(firstDecreasingItem) + 1)
            : config.positionIncrement * (items.length + 1);
    }

    // Create a sort function that will return if the position is out of sequence
    const sort =
        config.sortOrder === 'desc'
            ? (a: number, b: number) => {
                  return a < b;
              }
            : (a: number, b: number) => {
                  return a > b;
              };

    // Loop through the items and update the position
    items.forEach((item, index) => {
        if (item.Position === undefined) {
            const previousItem = index === 0 ? null : items[index - 1];
            const previousPosition = previousItem?.Position ?? previousItem?.OriginalPosition ?? maxPosition;
            const nextItemIndexRelative = items
                .slice(index + 1)
                .findIndex((i) => i.OriginalPosition && sort(i.OriginalPosition, previousPosition));
            const nextItemIndexAbsolute = nextItemIndexRelative > -1 ? index + 1 + nextItemIndexRelative : items.length;
            const nextItem = nextItemIndexRelative > -1 ? items[nextItemIndexAbsolute] : null;

            // If this item is out of sequence
            const outOfSequencePrevious =
                item.OriginalPosition && previousPosition && !sort(item.OriginalPosition, previousPosition);
            const outOfSequenceNext =
                item.OriginalPosition &&
                nextItem?.OriginalPosition &&
                sort(item.OriginalPosition, nextItem?.OriginalPosition);

            if (outOfSequencePrevious || outOfSequenceNext || item.OriginalPosition === undefined) {
                // itterate over the items from this until the next item that has an originalPosition is greater/smaller than the previousPosition
                const numberOfItemsBetween = nextItemIndexAbsolute - index;
                const nextPosition = nextItem?.OriginalPosition ?? previousPosition + numberOfItemsBetween * increment;

                let subIncrement = increment;
                if (config.sortOrder === 'asc' && (previousItem || nextItem)) {
                    subIncrement = (nextPosition - previousPosition) / (numberOfItemsBetween + (nextItem ? 1 : 0));
                } else if (config.sortOrder === 'desc' && previousItem) {
                    subIncrement = nextItem
                        ? (nextPosition - previousPosition) / (numberOfItemsBetween + 1)
                        : increment / (numberOfItemsBetween + 1);
                }
                // If minimum increment
                if (config.minimumIncrement && Math.abs(subIncrement) < config.minimumIncrement) {
                    subIncrement = config.minimumIncrement * 2 * sortDirectionMultipler;
                }
                let newPosition = previousPosition;

                // Special case for when we reach zero for sorting in descending order
                if (
                    !config.allowNegative &&
                    config.sortOrder === 'desc' &&
                    newPosition + numberOfItemsBetween * subIncrement <= 0
                ) {
                    subIncrement = -previousPosition / (numberOfItemsBetween + 1);
                }

                for (let i = index; i < nextItemIndexAbsolute; i++) {
                    newPosition += subIncrement;

                    items[i].Position = Number(newPosition.toFixed(config.maxDecimalPlaces));
                }
            } else {
                item.Position = item.OriginalPosition;
            }
        }
        maxPosition = sort(maxPosition, item.Position ?? 0) ? item.Position ?? 0 : maxPosition;
        if (item.Position !== item.OriginalPosition) {
            item.HasMovedPosition = true;
        }
        if (item.DropZoneId !== item.OriginalDropZoneId) {
            item.HasMovedZone = true;
        }
    });
    return items;
}
