import { CustomSortPositionStrategy } from '../CustomSortPositionStrategy';
import { createReOrderableItems, insertNewItem, moveItemsSameZone } from '../_testhelpers_/SortOrderTestHelper';

describe('Custom Sort Position Descending', () => {
    let strategy: CustomSortPositionStrategy;

    beforeEach(() => {
        strategy = new CustomSortPositionStrategy();
        strategy.SetOptions({ sortOrder: 'desc' });
    });

    it('desc - add items to end of list', () => {
        const items = createReOrderableItems(5, { sort: 'desc' });
        insertNewItem(items, '1', items.length);
        insertNewItem(items, '1', items.length);
        expect(items[0].OriginalPosition).toBe(500);
        expect(items[1].OriginalPosition).toBe(400);
        expect(items[2].OriginalPosition).toBe(300);
        expect(items[3].OriginalPosition).toBe(200);
        expect(items[4].OriginalPosition).toBe(100);

        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(7);
        expect(result[0].Position).toBe(500);
        expect(result[1].Position).toBe(400);
        expect(result[2].Position).toBe(300);
        expect(result[3].Position).toBe(200);
        expect(result[4].Position).toBe(100);
        expect(result[5].Position).toBe(66.6667);
        expect(result[6].Position).toBe(33.3333);
    });

    it('desc - add item to end of list - same value', () => {
        const items = createReOrderableItems(5, { sort: 'desc' });
        insertNewItem(items, '1', items.length, 100);

        expect(items[0].OriginalPosition).toBe(500);
        expect(items[1].OriginalPosition).toBe(400);
        expect(items[2].OriginalPosition).toBe(300);
        expect(items[3].OriginalPosition).toBe(200);
        expect(items[4].OriginalPosition).toBe(100);
        expect(items[5].OriginalPosition).toBe(100); // new item

        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(6);
        expect(result[0].Position).toBe(500);
        expect(result[1].Position).toBe(400);
        expect(result[2].Position).toBe(300);
        expect(result[3].Position).toBe(200);
        expect(result[4].Position).toBe(150); // updated
        expect(result[5].Position).toBe(100);
    });

    it('desc - add items to top of list', () => {
        const items = createReOrderableItems(5, { sort: 'desc' });
        insertNewItem(items, '1', 0);
        insertNewItem(items, '1', 0);

        expect(items[0].OriginalPosition).toBe(undefined);
        expect(items[1].OriginalPosition).toBe(undefined);
        expect(items[2].OriginalPosition).toBe(500);
        expect(items[3].OriginalPosition).toBe(400);
        expect(items[4].OriginalPosition).toBe(300);
        expect(items[5].OriginalPosition).toBe(200);
        expect(items[6].OriginalPosition).toBe(100);

        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(7);
        expect(result[0].Position).toBe(700); // updated
        expect(result[1].Position).toBe(600); // updated
        expect(result[2].Position).toBe(500);
        expect(result[3].Position).toBe(400);
        expect(result[4].Position).toBe(300);
        expect(result[5].Position).toBe(200);
        expect(result[6].Position).toBe(100);
    });

    it('desc - when item is added to top of the items, it is the only item updated', () => {
        const items = createReOrderableItems(5, { sort: 'desc' });
        insertNewItem(items, '1', 0);
        expect(items[0].OriginalPosition).toBe(undefined); // new item
        expect(items[1].OriginalPosition).toBe(500);
        expect(items[2].OriginalPosition).toBe(400);
        expect(items[3].OriginalPosition).toBe(300);
        expect(items[4].OriginalPosition).toBe(200);
        expect(items[5].OriginalPosition).toBe(100);

        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(6);
        expect(result[0].Position).toBe(600); // updated
        expect(result[1].Position).toBe(500);
        expect(result[2].Position).toBe(400);
        expect(result[3].Position).toBe(300);
        expect(result[4].Position).toBe(200);
        expect(result[5].Position).toBe(100);
    });

    it('desc - when item is moved to the end of the items, it is the only item updated', () => {
        const items = createReOrderableItems(5, { sort: 'desc' });
        insertNewItem(items, '1', items.length);
        expect(items[0].OriginalPosition).toBe(500);
        expect(items[1].OriginalPosition).toBe(400);
        expect(items[2].OriginalPosition).toBe(300);
        expect(items[3].OriginalPosition).toBe(200);
        expect(items[4].OriginalPosition).toBe(100);
        expect(items[5].OriginalPosition).toBe(undefined); // new item

        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(6);
        expect(result[0].Position).toBe(500);
        expect(result[1].Position).toBe(400);
        expect(result[2].Position).toBe(300);
        expect(result[3].Position).toBe(200);
        expect(result[4].Position).toBe(100);
        expect(result[5].Position).toBe(50); // updated
    });

    it('desc - assigns the newposition correctly after swapping two items', () => {
        const items = createReOrderableItems(5, { sort: 'desc' });
        moveItemsSameZone(items, 1, 2);
        expect(items[0].OriginalPosition).toBe(500);
        expect(items[1].OriginalPosition).toBe(300); // moved up
        expect(items[2].OriginalPosition).toBe(400);
        // moved up from here
        expect(items[3].OriginalPosition).toBe(200);
        expect(items[4].OriginalPosition).toBe(100);
        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(5);
        expect(result[0].Position).toBe(500);
        expect(result[1].Position).toBe(450); // changed
        expect(result[2].Position).toBe(400);
        expect(result[3].Position).toBe(200);
        expect(result[4].Position).toBe(100);
    });

    it('desc - swap first and last items', () => {
        const items = createReOrderableItems(5, { sort: 'desc' });
        moveItemsSameZone(items, 4, 0);
        expect(items[0].OriginalPosition).toBe(100); // moved up
        expect(items[1].OriginalPosition).toBe(500);
        expect(items[2].OriginalPosition).toBe(400);
        expect(items[3].OriginalPosition).toBe(300);
        expect(items[4].OriginalPosition).toBe(200);
        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(5);
        expect(result[0].Position).toBe(600);
        expect(result[1].Position).toBe(500);
        expect(result[2].Position).toBe(400);
        expect(result[3].Position).toBe(300);
        expect(result[4].Position).toBe(200);
    });

    it('desc - swap first two items', () => {
        const items = createReOrderableItems(5, { sort: 'desc' });
        moveItemsSameZone(items, 1, 0);
        expect(items[0].OriginalPosition).toBe(400); // moved up
        expect(items[1].OriginalPosition).toBe(500);
        expect(items[2].OriginalPosition).toBe(300);
        expect(items[3].OriginalPosition).toBe(200);
        expect(items[4].OriginalPosition).toBe(100);
        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(5);
        expect(result[0].Position).toBe(600); // changed
        expect(result[1].Position).toBe(500);
        expect(result[2].Position).toBe(300);
        expect(result[3].Position).toBe(200);
        expect(result[4].Position).toBe(100);
    });

    it('desc - swap last two items', () => {
        const items = createReOrderableItems(5, { sort: 'desc' });
        moveItemsSameZone(items, 4, 3);
        expect(items[0].OriginalPosition).toBe(500);
        expect(items[1].OriginalPosition).toBe(400);
        expect(items[2].OriginalPosition).toBe(300);
        expect(items[3].OriginalPosition).toBe(100); //moved up
        expect(items[4].OriginalPosition).toBe(200);
        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(5);
        expect(result[0].Position).toBe(500);
        expect(result[1].Position).toBe(400);
        expect(result[2].Position).toBe(300);
        expect(result[3].Position).toBe(250);
        expect(result[4].Position).toBe(200);
    });

    it('desc - swap middle items', () => {
        const items = createReOrderableItems(5, { sort: 'desc' });
        moveItemsSameZone(items, 3, 1);
        expect(items[0].OriginalPosition).toBe(500);
        expect(items[1].OriginalPosition).toBe(200); // move up
        expect(items[2].OriginalPosition).toBe(400);
        expect(items[3].OriginalPosition).toBe(300);
        expect(items[4].OriginalPosition).toBe(100);
        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(5);
        expect(result[0].Position).toBe(500);
        expect(result[1].Position).toBe(450); // changed
        expect(result[2].Position).toBe(400);
        expect(result[3].Position).toBe(300);
        expect(result[4].Position).toBe(100);
    });

    it('desc - adds defaults where no items have a position', () => {
        // Test at syncSortOrdinalAddDefaults will add the newposition 100,200,300,400,500 when originalPosition is not set
        const items = createReOrderableItems(5, { setOriginalPosition: false, sort: 'desc' });
        expect(items[0].OriginalPosition).toBe(undefined);
        expect(items[1].OriginalPosition).toBe(undefined);
        expect(items[2].OriginalPosition).toBe(undefined);
        expect(items[3].OriginalPosition).toBe(undefined);
        expect(items[4].OriginalPosition).toBe(undefined);

        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(5);
        expect(result[0].Position).toBe(500);
        expect(result[1].Position).toBe(400);
        expect(result[2].Position).toBe(300);
        expect(result[3].Position).toBe(200);
        expect(result[4].Position).toBe(100);
    });

    it('desc - adds defaults where two adjascent items have no original position', () => {
        // Test at syncSortOrdinalAddDefaults will add the newposition 100,200,300,400,500 when originalPosition is not set
        const items = createReOrderableItems(5, { setOriginalPosition: false, sort: 'desc' });
        items[3].OriginalPosition = undefined;
        items[4].OriginalPosition = undefined;

        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(5);
        expect(result[0].Position).toBe(500);
        expect(result[1].Position).toBe(400);
        expect(result[2].Position).toBe(300);
        expect(result[3].Position).toBe(200);
        expect(result[4].Position).toBe(100);
    });

    it('desc - adds defaults where two adjascent items have no original position and the items either side are consecutive', () => {
        // Test at syncSortOrdinalAddDefaults will add the newposition 100,200,300,400,500 when originalPosition is not set
        const items = createReOrderableItems(3, { sort: 'desc' });
        insertNewItem(items, '1', 1);
        insertNewItem(items, '1', 2);

        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(5);
        expect(result[0].Position).toBe(300);
        expect(result[1].Position).toBe(266.6667);
        expect(result[2].Position).toBe(233.3333);
        expect(result[3].Position).toBe(200);
        expect(result[4].Position).toBe(100);
    });

    it('desc - move top below zero position', () => {
        const items = createReOrderableItems(3, { sort: 'desc' });
        insertNewItem(items, '1', items.length, 50);
        insertNewItem(items, '1', items.length);
        expect(items[0].OriginalPosition).toBe(300);
        expect(items[1].OriginalPosition).toBe(200);
        expect(items[2].OriginalPosition).toBe(100);
        expect(items[3].OriginalPosition).toBe(50);
        expect(items[4].OriginalPosition).toBe(undefined);

        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(5);
        expect(result[0].Position).toBe(300);
        expect(result[1].Position).toBe(200);
        expect(result[2].Position).toBe(100);
        expect(result[3].Position).toBe(50);
        expect(result[4].Position).toBe(25);
    });

    it('desc - move top below zero position - decimal rounding', () => {
        const items = createReOrderableItems(2, { sort: 'desc' });
        insertNewItem(items, '1', items.length, 50);
        insertNewItem(items, '1', items.length, 25);
        insertNewItem(items, '1', items.length);
        expect(items[0].OriginalPosition).toBe(200);
        expect(items[1].OriginalPosition).toBe(100);
        expect(items[2].OriginalPosition).toBe(50);
        expect(items[3].OriginalPosition).toBe(25);
        expect(items[4].OriginalPosition).toBe(undefined);

        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(5);
        expect(result[0].Position).toBe(200);
        expect(result[1].Position).toBe(100);
        expect(result[2].Position).toBe(50);
        expect(result[3].Position).toBe(25);
        expect(result[4].Position).toBe(12.5);
    });

    it('desc - move top below zero position - below 1 decimal places', () => {
        const items = createReOrderableItems(0, { sort: 'desc' });
        insertNewItem(items, '1', items.length, 2);
        insertNewItem(items, '1', items.length, 1);
        insertNewItem(items, '1', items.length, 0.5);
        insertNewItem(items, '1', items.length);
        expect(items[0].OriginalPosition).toBe(2);
        expect(items[1].OriginalPosition).toBe(1);
        expect(items[2].OriginalPosition).toBe(0.5);
        expect(items[3].OriginalPosition).toBe(undefined);

        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(4);
        expect(result[0].Position).toBe(2);
        expect(result[1].Position).toBe(1);
        expect(result[2].Position).toBe(0.5);
        expect(result[3].Position).toBe(0.25);
    });

    it('desc - move top below zero position - with no minimum increment', () => {
        const items = createReOrderableItems(0, { sort: 'desc' });
        insertNewItem(items, '1', items.length, 300);
        insertNewItem(items, '1', items.length, 270);
        insertNewItem(items, '1', items.length, 280);
        insertNewItem(items, '1', items.length, 260);

        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(4);
        expect(result[0].Position).toBe(300);
        expect(result[1].Position).toBe(290);
        expect(result[2].Position).toBe(280);
        expect(result[3].Position).toBe(260);
    });

    it('desc - move top below zero position - with no minimum increment of 100', () => {
        const items = createReOrderableItems(0, { sort: 'desc' });
        strategy.SetOptions({ sortOrder: 'desc', minimumIncrement: 100 });
        insertNewItem(items, '1', items.length, 30);
        insertNewItem(items, '1', items.length, 40);
        insertNewItem(items, '1', items.length, 28);
        insertNewItem(items, '1', items.length, 27);

        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(4);
        expect(result[0].Position).toBe(140);
        expect(result[1].Position).toBe(40);
        expect(result[2].Position).toBe(28);
        expect(result[3].Position).toBe(27);
    });
});
