import { IInputs } from '../generated/ManifestTypes';
import { ItemRenderer } from '../ItemRenderer';
import { DirectionEnum, ItemProperties, SortDirection } from '../ManifestConstants';
import { MockContext } from '../__mocks__/mock-context';
import { getMockParameters } from '../__mocks__/mock-parameters';
import { MockEntityRecord } from '../__mocks__/mock-datasets';

describe('ItemRenderer', () => {
    it('renders with aliases set', () => {
        const parameters = getMockParameters();
        const { result, renderer } = render(parameters);
        expect(result).toBeDefined();
        expect(result.itemsRendered).toBeDefined();
        expect(result.itemsRendered).toHaveLength(0);
        expect(renderer.rendered).toBe(true);
        // Expect no display: flex to be added
        expect(renderer.mainContainer).toMatchInlineSnapshot(`
            <div
              class="powerdnd-main-container"
              style="overflow: hidden; padding: 0px 0px 0px 0px; border-width: 0px; border-radius: 0px;"
            >
              <ul
                class="powerdnd-list"
                data-render-version="1"
                style="overflow-x: hidden; overflow-y: hidden;"
                tabindex="-1"
              />
            </div>
        `);
    });

    it('adds flex and wrap styles', () => {
        const parameters = getMockParameters();
        parameters.Direction.raw = DirectionEnum.Horizontal;
        const { result, renderer } = render(parameters);
        expect(result).toBeDefined();
        expect(result.itemsRendered).toBeDefined();
        expect(result.itemsRendered).toHaveLength(0);
        expect(renderer.rendered).toBe(true);
        // Expect display: flex to be added
        expect(renderer.mainContainer).toMatchInlineSnapshot(`
            <div
              class="powerdnd-main-container"
              style="overflow: hidden; padding: 0px 0px 0px 0px; border-width: 0px; border-radius: 0px;"
            >
              <ul
                class="powerdnd-list"
                data-render-version="1"
                style="overflow-x: hidden; overflow-y: hidden; flex-direction: row; flex-wrap: nowrap; display: flex;"
                tabindex="-1"
              />
            </div>
        `);

        // Change to wrap
        parameters.Wrap.raw = true;
        const result2 = render(parameters);

        // Expect the flex-wrap:wrap to be added
        expect(result2.renderer.mainContainer).toMatchInlineSnapshot(`
            <div
              class="powerdnd-main-container"
              style="overflow: hidden; padding: 0px 0px 0px 0px; border-width: 0px; border-radius: 0px;"
            >
              <ul
                class="powerdnd-list"
                data-render-version="1"
                style="overflow-x: hidden; overflow-y: hidden; flex-direction: row; flex-wrap: wrap; display: flex;"
                tabindex="-1"
              />
            </div>
        `);
    });

    it('add flex if wrap set but not direction', () => {
        const parameters = getMockParameters();
        parameters.Wrap.raw = true;
        const result = render(parameters);
        expect(result).toBeDefined();
        // Expect flex-wrap: wrap; to be added
        expect(result.renderer.mainContainer).toMatchInlineSnapshot(`
            <div
              class="powerdnd-main-container"
              style="overflow: hidden; padding: 0px 0px 0px 0px; border-width: 0px; border-radius: 0px;"
            >
              <ul
                class="powerdnd-list"
                data-render-version="1"
                style="overflow-x: hidden; overflow-y: hidden; flex-direction: row; flex-wrap: wrap; display: flex;"
                tabindex="-1"
              />
            </div>
        `);
    });

    it('adds index attributes - ascending', () => {
        const parameters = getParametersWithItems();
        const result = render(parameters);
        expect(result).toBeDefined();
        // Expect flex-wrap: wrap; to be added
        expect(result.renderer.mainContainer).toMatchInlineSnapshot(`
            <div
              class="powerdnd-main-container"
              style="overflow: hidden; padding: 0px 0px 0px 0px; border-width: 0px; border-radius: 0px;"
            >
              <ul
                class="powerdnd-list"
                data-render-version="1"
                style="overflow-x: hidden; overflow-y: hidden;"
                tabindex="-1"
              >
                <li
                  class="powerdnd-item powerdnd-item-simple"
                  data-id="Item 1"
                  data-original-position="1"
                  data-original-zone="Zone 1"
                  data-render-version="1"
                >
                  <div
                    class="powerdnd-item-value"
                  >
                    Item 1
                  </div>
                  <div
                    class="powerdnd-item-value"
                  >
                    Zone 1
                  </div>
                </li>
                <li
                  class="powerdnd-item powerdnd-item-simple"
                  data-id="Item 1"
                  data-original-position="2"
                  data-original-zone="Zone 1"
                  data-render-version="1"
                >
                  <div
                    class="powerdnd-item-value"
                  >
                    Item 1
                  </div>
                  <div
                    class="powerdnd-item-value"
                  >
                    Zone 1
                  </div>
                </li>
              </ul>
            </div>
        `);
    });

    it('adds index attributes - descending', () => {
        const parameters = getParametersWithItems();
        parameters.SortDirection.raw = SortDirection.Descending;
        const result = render(parameters);
        expect(result).toBeDefined();
        // Expect flex-wrap: wrap; to be added
        expect(result.renderer.mainContainer).toMatchInlineSnapshot(`
          <div
            class="powerdnd-main-container"
            style="overflow: hidden; padding: 0px 0px 0px 0px; border-width: 0px; border-radius: 0px;"
          >
            <ul
              class="powerdnd-list"
              data-render-version="1"
              style="overflow-x: hidden; overflow-y: hidden;"
              tabindex="-1"
            >
              <li
                class="powerdnd-item powerdnd-item-simple"
                data-id="Item 1"
                data-original-position="2"
                data-original-zone="Zone 1"
                data-render-version="1"
              >
                <div
                  class="powerdnd-item-value"
                >
                  Item 1
                </div>
                <div
                  class="powerdnd-item-value"
                >
                  Zone 1
                </div>
              </li>
              <li
                class="powerdnd-item powerdnd-item-simple"
                data-id="Item 1"
                data-original-position="1"
                data-original-zone="Zone 1"
                data-render-version="1"
              >
                <div
                  class="powerdnd-item-value"
                >
                  Item 1
                </div>
                <div
                  class="powerdnd-item-value"
                >
                  Zone 1
                </div>
              </li>
            </ul>
          </div>
      `);
    });
});

function getParametersWithItems() {
    const parameters = getMockParameters();
    parameters.items.columns.push({
        alias: ItemProperties.ZoneColumn,
        name: 'IdColumn',
        displayName: '',
        order: 1,
        visualSizeFactor: 0,
        dataType: 'string',
    });
    parameters.items.columns.push({
        alias: ItemProperties.ZoneColumn,
        name: 'ZoneColumn',
        displayName: '',
        order: 2,
        visualSizeFactor: 0,
        dataType: 'string',
    });
    parameters.items.records = {
        1: new MockEntityRecord('1', { IdColumn: 'Item 1', ZoneColumn: 'Zone 1' }),
        2: new MockEntityRecord('2', { IdColumn: 'Item 1', ZoneColumn: 'Zone 1' }),
    };
    parameters.items.sortedRecordIds = ['1', '2'];
    parameters.DropZoneID.raw = 'Zone 1';
    parameters.SortDirection.raw = SortDirection.Ascending;
    return parameters;
}

function render(parameters: IInputs) {
    const container = document.createElement('div');
    const renderer = new ItemRenderer(container);
    const context = new MockContext(parameters);
    const result = renderer.renderItems(context, {
        type: 'index',
        direction: parameters.SortDirection.raw === SortDirection.Ascending ? 'asc' : 'desc',
    });
    return { result, renderer };
}
