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
    Partial<Pick<CurrentItem, 'Position' | 'OriginalPosition' | 'HasMovedZone' | 'HasMovedPosition'>> & {
        Index?: number;
    };

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

const defaultConfig = {
    positionIncrement: 100,
    sortOrder: 'asc',
    allowNegative: false,
    maxDecimalPlaces: 4,
} as CustomSortPositionsOptions;

export class CustomSortPositionStrategy {
    private config = defaultConfig;
    private items: Partial<ReOrderableItem>[] = [];

    public SetOptions(options?: Partial<CustomSortPositionsOptions>) {
        this.config = { ...defaultConfig, ...options };
    }
    public updateSortPosition(itemsToSort: Partial<ReOrderableItem>[]) {
        this.items = itemsToSort;

        let firstPositionValue = this.getFirstPositionValue();

        this.items.forEach((item, index) => {
            // Has the position already been set in a previous loop iteration? If so, skip
            if (item.Position !== undefined) {
                firstPositionValue = Math.max(firstPositionValue, item.Position);
                item.HasMovedPosition = item.Position !== item.OriginalPosition;
                item.HasMovedZone = item.DropZoneId !== item.OriginalDropZoneId;
                return;
            }

            const previousItem = index === 0 ? null : this.items[index - 1];
            const previousPosition = this.getPreviousPosition(previousItem, firstPositionValue);
            const nextItem = this.getNextNonOutOfSequenceItem(index, previousPosition);
            const isPreviousOutOfSequence = this.isItemOutOfSequence(item, 'previous', previousPosition);
            const isNextOutOfSequence = this.isItemOutOfSequence(item, 'next', nextItem?.OriginalPosition);

            if (isPreviousOutOfSequence || isNextOutOfSequence || item.OriginalPosition === undefined) {
                const subIncrement = this.getSubIncrement(index, nextItem, previousItem, previousPosition);
                let newPosition = previousPosition;
                // Set the position of the item and all items up until the next out of sequence item
                const endIndex = nextItem?.Index ?? this.items.length;
                for (let i = index; i < endIndex; i++) {
                    newPosition += subIncrement;
                    this.items[i].Position = Number(newPosition.toFixed(this.config.maxDecimalPlaces));
                }
            } else {
                item.Position = item.OriginalPosition;
            }

            firstPositionValue = Math.max(firstPositionValue, item.Position ?? 0);
            item.HasMovedPosition = item.Position !== item.OriginalPosition;
            item.HasMovedZone = item.DropZoneId !== item.OriginalDropZoneId;
        });

        return this.items;
    }

    private getFirstPositionValue() {
        let firstPositionValue = 0;
        if (this.config.sortOrder === 'desc') {
            const firstDecreasingItem = this.items.find((item, index) => {
                if (index === this.items.length - 1) {
                    return false; // skip last item
                }
                return (item.OriginalPosition ?? 0) > (this.items[index + 1].OriginalPosition ?? 0);
            });
            firstPositionValue = firstDecreasingItem?.OriginalPosition
                ? firstDecreasingItem.OriginalPosition +
                  this.config.positionIncrement * (this.items.indexOf(firstDecreasingItem) + 1)
                : this.config.positionIncrement * (this.items.length + 1);
        }
        return firstPositionValue;
    }

    private getSubIncrement(
        index: number,
        nextItem: Partial<ReOrderableItem> | null,
        previousItem: Partial<ReOrderableItem> | null,
        previousPosition: number,
    ) {
        const sortDirectionMultiplier = this.config.sortOrder === 'asc' ? 1 : -1;
        const increment = this.config.positionIncrement * sortDirectionMultiplier;
        const numberOfItemsBetweenOrEnd = (nextItem?.Index ?? this.items.length) - index;
        const nextPosition = nextItem?.OriginalPosition ?? previousPosition + numberOfItemsBetweenOrEnd * increment;

        let subIncrement = (nextPosition - previousPosition) / (numberOfItemsBetweenOrEnd + (nextItem ? 1 : 0));

        // Special case for when we are sequencing all the way to the end of the list
        if (this.config.sortOrder === 'desc' && !nextItem && previousItem) {
            subIncrement = increment / (numberOfItemsBetweenOrEnd + 1);
        }

        if (this.config.minimumIncrement && Math.abs(subIncrement) < this.config.minimumIncrement) {
            subIncrement = this.config.minimumIncrement * 2 * sortDirectionMultiplier;
        }

        // Special case when we do not allow negative numbers, the increment is squashed
        // This can result in duplicate positions
        if (
            !this.config.allowNegative &&
            this.config.sortOrder === 'desc' &&
            previousPosition + numberOfItemsBetweenOrEnd * subIncrement <= 0
        ) {
            subIncrement = -previousPosition / (numberOfItemsBetweenOrEnd + 1);
        }

        return subIncrement;
    }

    private getNextNonOutOfSequenceItem(index: number, previousPosition: number) {
        const nextItemIndexRelative = this.items
            .slice(index + 1)
            .findIndex(
                (i) =>
                    i.OriginalPosition &&
                    (this.config.sortOrder === 'asc'
                        ? i.OriginalPosition > previousPosition
                        : i.OriginalPosition < previousPosition),
            );
        const nextItemIndexAbsolute =
            nextItemIndexRelative > -1 ? index + 1 + nextItemIndexRelative : this.items.length;
        const nextItem = nextItemIndexRelative > -1 ? this.items[nextItemIndexAbsolute] : null;
        if (nextItem) nextItem.Index = nextItemIndexAbsolute;
        return nextItem;
    }

    private getPreviousPosition(previousItem: Partial<ReOrderableItem> | null, firstPositionValue: number) {
        return previousItem?.Position ?? previousItem?.OriginalPosition ?? firstPositionValue;
    }

    private isItemOutOfSequence(
        item: Partial<ReOrderableItem>,
        direction: 'previous' | 'next',
        comparePosition?: number,
    ) {
        return (
            item.OriginalPosition &&
            comparePosition !== undefined &&
            ((this.config.sortOrder === 'asc' && direction === 'next') ||
            (this.config.sortOrder === 'desc' && direction === 'previous')
                ? item.OriginalPosition >= comparePosition
                : item.OriginalPosition <= comparePosition)
        );
    }
}
