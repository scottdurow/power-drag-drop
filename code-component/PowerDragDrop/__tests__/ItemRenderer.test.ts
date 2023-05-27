import { IInputs } from '../generated/ManifestTypes';
import { ItemRenderer } from '../ItemRenderer';
import { DirectionEnum } from '../ManifestConstants';
import { MockContext } from '../__mocks__/mock-context';
import { getMockParameters } from '../__mocks__/mock-parameters';

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
});

function render(parameters: IInputs) {
    const container = document.createElement('div');
    const renderer = new ItemRenderer(container);
    const context = new MockContext(parameters);
    const result = renderer.renderItems(context, { type: 'index', direction: 'asc' });
    return { result, renderer };
}
