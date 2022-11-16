import * as Handlebars from 'handlebars';
import { escape } from 'html-escaper';
import sanitize from 'sanitize-html';
import { CurrentItem } from './CurrentItemSchema';
import { GetOutputObjectRecord } from './DynamicSchema';
import { IInputs } from './generated/ManifestTypes';
import { ItemProperties } from './ManifestConstants';
import { SanitizeHtmlOptions } from './SanitizeHtmlOptions';
import { CSS_STYLE_CLASSES, ORIGINAL_POSITION_ATTRIBUTE, ORIGINAL_ZONE_ATTRIBUTE, RECORD_ID_ATTRIBUTE } from './Styles';

export class ItemRenderer {
    public rendered = false;
    public mainContainer: HTMLElement;
    public listContainer: HTMLElement;

    constructor(container: HTMLDivElement) {
        // Create root containers
        this.mainContainer = document.createElement('div');
        this.mainContainer.classList.add(CSS_STYLE_CLASSES.MainContainer);
        this.mainContainer.style.overflow = 'hidden';

        this.listContainer = document.createElement('ul');
        this.listContainer.classList.add(CSS_STYLE_CLASSES.List);
        this.mainContainer.appendChild(this.listContainer);

        container.appendChild(this.mainContainer);
    }

    public updateContainerSize(context: ComponentFramework.Context<IInputs>): void {
        const mainContainer = this.mainContainer;
        const listContainer = this.listContainer;

        mainContainer.style.width = `${context.mode.allocatedWidth}px`;
        mainContainer.style.height = `${context.mode.allocatedHeight}px`;
        listContainer.style.height = `${context.mode.allocatedHeight}px`;
    }

    private checkForAliases(context: ComponentFramework.Context<IInputs>) {
        // If there is no Id or Zone column defined, then report a message to the maker
        if (
            !context.parameters.items.columns.find((c) => c.alias === ItemProperties.IdColumn && c.name !== null) ||
            !context.parameters.items.columns.find((c) => c.alias === ItemProperties.ZoneColumn && c.name !== null)
        ) {
            this.renderMessage(
                'Please set both <strong>IdColumn</strong> and <strong>ZoneColumn</strong> column aliases in the <strong>Advanced Properties</strong> panel.',
            );
            return false;
        }
        return true;
    }

    public renderItems(
        context: ComponentFramework.Context<IInputs>,
    ): { itemsRendered?: CurrentItem[]; sortOrder?: string[] } {
        const parameters = context.parameters;
        const dataset = context.parameters.items;
        const currentItems: CurrentItem[] = [];
        const originalOrder: string[] = [];
        const listContainer = this.listContainer;

        if (!this.checkForAliases(context)) return {};
        this.rendered = true;
        const isMasterZone = parameters.IsMasterZone.raw === true;

        this.removeAllExistingElements();

        // Get sorted columns on collection provided as the dataset
        const fieldsOnDataset = this.getSortedFieldsOnDataset(context);
        const template = parameters.ItemTemplate.raw ?? '';
        const renderTemplate = template !== '' ? Handlebars.compile<unknown>(template) : undefined;

        // Initial Current Items
        if (isMasterZone) {
            const zoneCounts: Record<string, number> = {};
            dataset.sortedRecordIds.forEach((id, index) => {
                const record = dataset.records[id];
                const zone = record.getFormattedValue(ItemProperties.ZoneColumn);
                const itemId = record.getFormattedValue(ItemProperties.IdColumn);
                if (zoneCounts[zone] === undefined) {
                    zoneCounts[zone] = 1;
                } else {
                    zoneCounts[zone] = zoneCounts[zone] + 1;
                }
                // If the sort is being preserved, the position is based on all the items rather than just the items in the zone
                const positionInZone = parameters.PreserveSort.raw === true ? index + 1 : zoneCounts[zone];
                const item: CurrentItem = {
                    DropZoneId: zone,
                    ItemId: itemId,
                    Position: positionInZone,
                    OriginalPosition: positionInZone,
                    OriginalDropZoneId: zone,
                    HasMovedPosition: false,
                    HasMovedZone: false,
                };
                originalOrder.push(item.ItemId);
                currentItems.push(item);
            });
        }

        // Style the list container
        this.updateContainerStyles(parameters);

        // Items for this drop zone (or all items if the drop zone is not set)
        const thisDropZoneId = parameters.DropZoneID.raw ?? '';
        const items = dataset.sortedRecordIds
            .map((id, index) => {
                return { record: dataset.records[id], index: index + 1 };
            })
            .filter(
                (item: { record: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord; index: number }) =>
                    thisDropZoneId === '' ||
                    item.record.getFormattedValue(ItemProperties.ZoneColumn) === parameters.DropZoneID.raw,
            );

        let index = 0;
        for (const itemInThisZone of items) {
            const item = itemInThisZone.record;
            index++;
            const itemRow: HTMLElement = document.createElement('li');
            itemRow.classList.add(CSS_STYLE_CLASSES.Item);

            // Style accordingly to the parameters
            this.styleItemElement(itemRow, parameters);

            // Set the index of the item in the source dataset - this is used when we drop an item
            const itemId = item.getValue(ItemProperties.IdColumn)
                ? item.getFormattedValue(ItemProperties.IdColumn)
                : index.toString();
            itemRow.setAttribute(RECORD_ID_ATTRIBUTE, itemId);
            // If the sort is being preserved, the position is based on all the items rather than just the items in the zone
            itemRow.setAttribute(
                ORIGINAL_POSITION_ATTRIBUTE,
                (parameters.PreserveSort.raw === true ? itemInThisZone.index : index).toString(),
            );
            itemRow.setAttribute(ORIGINAL_ZONE_ATTRIBUTE, parameters.DropZoneID.raw as string);

            if (renderTemplate) {
                // Render mustache template
                const renderResult = this.renderHTMLTemplate(itemRow, item, fieldsOnDataset, renderTemplate);
                // If failed, stop rendering
                if (!renderResult) break;
            } else {
                // Render simple template
                this.renderSimpleTemplate(itemRow, item, fieldsOnDataset);
            }

            listContainer.appendChild(itemRow);
        }

        return { itemsRendered: currentItems, sortOrder: originalOrder };
    }

    private removeAllExistingElements() {
        const listContainer = this.listContainer;
        while (listContainer.firstChild && listContainer.firstChild.parentNode) {
            listContainer.firstChild.parentNode.removeChild(listContainer.firstChild);
        }
    }

    private getSortedFieldsOnDataset(
        context: ComponentFramework.Context<IInputs>,
    ): ComponentFramework.PropertyHelper.DataSetApi.Column[] {
        if (!context.parameters.items.columns) {
            return [];
        }
        const columns = context.parameters.items.columns.filter((c) => c.order !== -1);
        return columns;
    }

    private updateContainerStyles(parameters: IInputs) {
        const mainContainer = this.mainContainer;
        const listContainer = this.listContainer;

        if (parameters.PaddingLeft?.raw !== null) {
            mainContainer.style.paddingLeft = parameters.PaddingLeft.raw + 'px';
        }
        if (parameters.PaddingRight?.raw !== null) {
            mainContainer.style.paddingRight = parameters.PaddingRight.raw + 'px';
        }
        if (parameters.PaddingTop?.raw !== null) {
            mainContainer.style.paddingTop = parameters.PaddingTop.raw + 'px';
        }
        if (parameters.PaddingBottom?.raw !== null) {
            mainContainer.style.paddingBottom = parameters.PaddingBottom.raw + 'px';
        }
        if (parameters.BackgroundColor?.raw !== null) {
            mainContainer.style.backgroundColor = parameters.BackgroundColor.raw;
        }
        if (parameters.BorderColor?.raw !== null) {
            mainContainer.style.borderColor = parameters.BorderColor.raw;
        }
        if (parameters.BorderWidth?.raw !== null) {
            mainContainer.style.borderWidth = parameters.BorderWidth.raw + 'px';
        }
        if (parameters.BorderRadius?.raw !== null) {
            mainContainer.style.borderRadius = parameters.BorderRadius.raw + 'px';
        }
        if (parameters.Scroll?.raw !== null) {
            listContainer.style.overflow = parameters.Scroll?.raw ? 'auto' : 'hidden';
        }
    }

    private styleItemElement(itemRow: HTMLElement, parameters: IInputs) {
        if (parameters.ItemBackgroundColor.raw) {
            itemRow.style.backgroundColor = parameters.ItemBackgroundColor.raw;
        }
        if (parameters.ItemBorderColor.raw) {
            itemRow.style.borderColor = parameters.ItemBorderColor.raw;
        }
        if (parameters.ItemBorderWidth.raw) {
            itemRow.style.borderWidth = parameters.ItemBorderWidth.raw + 'px';
        }
        if (parameters.ItemBorderRadius.raw) {
            itemRow.style.borderRadius = parameters.ItemBorderRadius.raw + 'px';
        }
        if (parameters.ItemGap.raw) {
            itemRow.style.marginBottom = parameters.ItemGap.raw + 'px';
        }
        if (parameters.ItemFontSize.raw) {
            itemRow.style.fontSize = parameters.ItemFontSize.raw + 'px';
        }
        if (parameters.ItemFontColor.raw) {
            itemRow.style.color = parameters.ItemFontColor.raw;
        }
        if (parameters.ItemFont.raw) {
            itemRow.style.fontFamily = parameters.ItemFont.raw;
        }
    }

    private renderHTMLTemplate(
        itemRow: HTMLElement,
        item: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord,
        fieldsOnDataset: ComponentFramework.PropertyHelper.DataSetApi.Column[],
        template: HandlebarsTemplateDelegate<unknown>,
    ): boolean {
        // Mustache caches templates - so we don't need to pre-cache
        const innerDiv = document.createElement('div');
        try {
            const itemData = GetOutputObjectRecord(item, fieldsOnDataset);
            const result = template(itemData);
            // Sanitize so we can't include scripts etc.
            const sanitizedResult = sanitize(result, SanitizeHtmlOptions);
            innerDiv.innerHTML = sanitizedResult;
            itemRow.appendChild(innerDiv);
            return true;
        } catch (e) {
            itemRow.appendChild(this.createMessageElement(`Template Error:<br>${escape(JSON.stringify(e))}`));
            return false;
        }
    }

    private renderSimpleTemplate(
        itemRow: HTMLElement,
        item: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord,
        fieldsOnDataset: ComponentFramework.PropertyHelper.DataSetApi.Column[],
    ) {
        itemRow.classList.add(CSS_STYLE_CLASSES.ItemSimple);
        fieldsOnDataset.forEach(function (columnItem) {
            const innerDiv = document.createElement('div');
            innerDiv.classList.add(CSS_STYLE_CLASSES.ItemValue);
            innerDiv.innerText = item.getFormattedValue(columnItem.name);
            itemRow.appendChild(innerDiv);
        });
    }

    public renderMessage(messageHml: string): void {
        this.removeAllExistingElements();
        this.listContainer.appendChild(this.createMessageElement(messageHml));
    }

    private createMessageElement(messageHtml: string): HTMLElement {
        const element = document.createElement('div');
        element.className = CSS_STYLE_CLASSES.Warning;
        element.innerHTML = `<span class="${CSS_STYLE_CLASSES}"></span><span>${messageHtml}</span>`;
        return element;
    }
}
