import { CustomSortPositionStrategy } from '../CustomSortPositionStrategy';
import { createReOrderableItems, insertNewItem, moveItemsSameZone } from '../_testhelpers_/SortOrderTestHelper';

describe('Custom Sort Position Ascending', () => {
    let strategy: CustomSortPositionStrategy;

    beforeEach(() => {
        strategy = new CustomSortPositionStrategy();
        strategy.SetOptions({ sortOrder: 'asc' });
    });

    it('asc - add items to end of list', () => {
        const items = createReOrderableItems(5);
        insertNewItem(items, '1', items.length);
        insertNewItem(items, '1', items.length);

        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(7);
        expect(result[0].Position).toBe(100);
        expect(result[1].Position).toBe(200);
        expect(result[2].Position).toBe(300);
        expect(result[3].Position).toBe(400);
        expect(result[4].Position).toBe(500);
        expect(result[5].Position).toBe(600);
        expect(result[6].Position).toBe(700);
    });

    it('asc - add items to top of list', () => {
        const items = createReOrderableItems(5);
        insertNewItem(items, '1', 0);
        insertNewItem(items, '1', 0);

        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(7);
        expect(result[0].Position).toBe(33.3333);
        expect(result[1].Position).toBe(66.6667);
        expect(result[2].Position).toBe(100);
        expect(result[3].Position).toBe(200);
        expect(result[4].Position).toBe(300);
        expect(result[5].Position).toBe(400);
        expect(result[6].Position).toBe(500);
    });

    it('asc - when item is added to top of the items, it is the only item updated', () => {
        const items = createReOrderableItems(5);
        insertNewItem(items, '1', 0);
        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(6);
        expect(result[0].Position).toBe(50);
        expect(result[1].Position).toBe(100);
        expect(result[2].Position).toBe(200);
        expect(result[3].Position).toBe(300);
        expect(result[4].Position).toBe(400);
        expect(result[5].Position).toBe(500);
    });

    it('asc - when item is moved to the end of the items, it is the only item updated', () => {
        const items = createReOrderableItems(5);
        insertNewItem(items, '1', items.length);
        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(6);
        expect(result[0].Position).toBe(100);
        expect(result[1].Position).toBe(200);
        expect(result[2].Position).toBe(300);
        expect(result[3].Position).toBe(400);
        expect(result[4].Position).toBe(500);
        expect(result[5].Position).toBe(600);
    });

    it('asc - assigns the newposition correctly after swapping two items', () => {
        const items = createReOrderableItems(5);
        moveItemsSameZone(items, 1, 2);
        expect(items[0].OriginalPosition).toBe(100);
        expect(items[1].OriginalPosition).toBe(300);
        expect(items[2].OriginalPosition).toBe(200);
        expect(items[3].OriginalPosition).toBe(400);
        expect(items[4].OriginalPosition).toBe(500);
        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(5);
        expect(result[0].Position).toBe(100);
        expect(result[1].Position).toBe(150);
        expect(result[2].Position).toBe(200);
        expect(result[3].Position).toBe(400);
        expect(result[4].Position).toBe(500);
    });

    it('asc - swap first two items', () => {
        const items = createReOrderableItems(5);
        moveItemsSameZone(items, 1, 0);
        expect(items[0].OriginalPosition).toBe(200);
        expect(items[1].OriginalPosition).toBe(100);
        expect(items[2].OriginalPosition).toBe(300);
        expect(items[3].OriginalPosition).toBe(400);
        expect(items[4].OriginalPosition).toBe(500);
        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(5);
        expect(result[0].Position).toBe(50);
        expect(result[1].Position).toBe(100);
        expect(result[2].Position).toBe(300);
        expect(result[3].Position).toBe(400);
        expect(result[4].Position).toBe(500);
    });

    it('asc - swap last two items', () => {
        const items = createReOrderableItems(5);
        moveItemsSameZone(items, 4, 3);
        expect(items[0].OriginalPosition).toBe(100);
        expect(items[1].OriginalPosition).toBe(200);
        expect(items[2].OriginalPosition).toBe(300);
        expect(items[3].OriginalPosition).toBe(500);
        expect(items[4].OriginalPosition).toBe(400);
        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(5);
        expect(result[0].Position).toBe(100);
        expect(result[1].Position).toBe(200);
        expect(result[2].Position).toBe(300);
        expect(result[3].Position).toBe(350);
        expect(result[4].Position).toBe(400);
    });

    it('asc - swap middle items', () => {
        const items = createReOrderableItems(5);
        moveItemsSameZone(items, 3, 1);
        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(5);
        expect(result[0].Position).toBe(100);
        expect(result[1].Position).toBe(150);
        expect(result[2].Position).toBe(200);
        expect(result[3].Position).toBe(300);
        expect(result[4].Position).toBe(500);
    });

    it('asc - adds defaults where no items have a position', () => {
        // Test at syncSortOrdinalAddDefaults will add the newposition 100,200,300,400,500 when originalPosition is not set
        const items = createReOrderableItems(5, { setOriginalPosition: false });

        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(5);
        expect(result[0].Position).toBe(100);
        expect(result[1].Position).toBe(200);
        expect(result[2].Position).toBe(300);
        expect(result[3].Position).toBe(400);
        expect(result[4].Position).toBe(500);
    });

    it('asc - adds defaults where two adjascent items have no original position', () => {
        // Test at syncSortOrdinalAddDefaults will add the newposition 100,200,300,400,500 when originalPosition is not set
        const items = createReOrderableItems(5, { setOriginalPosition: false });
        items[3].OriginalPosition = undefined;
        items[4].OriginalPosition = undefined;

        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(5);
        expect(result[0].Position).toBe(100);
        expect(result[1].Position).toBe(200);
        expect(result[2].Position).toBe(300);
        expect(result[3].Position).toBe(400);
        expect(result[4].Position).toBe(500);
    });

    it('asc - adds defaults where two adjascent items have no original position and the items either side are consecutive', () => {
        // Test at syncSortOrdinalAddDefaults will add the newposition 100,200,300,400,500 when originalPosition is not set
        const items = createReOrderableItems(3);
        insertNewItem(items, '1', 1);
        insertNewItem(items, '1', 2);

        const result = strategy.updateSortPosition(items);
        expect(result).toBeDefined();
        expect(result).toHaveLength(5);
        expect(result[0].Position).toBe(100);
        expect(result[1].Position).toBe(133.3333);
        expect(result[2].Position).toBe(166.6667);
        expect(result[3].Position).toBe(200);
        expect(result[4].Position).toBe(300);
    });
});
