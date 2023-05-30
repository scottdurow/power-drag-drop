import * as Handlebars from 'handlebars';
import { escape } from 'html-escaper';
import sanitize from 'sanitize-html';
import { CurrentItem } from './CurrentItemSchema';
import { GetOutputObjectRecord } from './DynamicSchema';
import { DirectionEnum, ItemProperties, ManifestConstants, SortPositionType } from './ManifestConstants';
import { SanitizeHtmlOptions } from './SanitizeHtmlOptions';
import {
    CSS_STYLE_CLASSES,
    ORIGINAL_POSITION_ATTRIBUTE,
    ORIGINAL_SORT_ORDER_ATTRIBUTE as ORIGINAL_SORT_POSITION_ATTRIBUTE,
    ORIGINAL_ZONE_ATTRIBUTE,
    RECORD_ID_ATTRIBUTE,
    RENDER_VERSION_ATTRIBUTE,
} from './Styles';
import { IInputs } from './generated/ManifestTypes';

export interface ItemSortStrategy {
    type: 'index' | 'customPosition';
    direction: 'asc' | 'desc';
}

export interface RowHTMLAttributes {
    renderVersion?: number;
    itemId: string;
    originalZone: string;
    originalSortPositionAttributeValue?: number;
    originalSortPosition: number;
}

export class ItemRenderer {
    public rendered = false;
    public mainContainer: HTMLElement;
    public listContainer: HTMLElement;
    public renderVersion = 0;

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
        mainContainer.style.width = `${context.mode.allocatedWidth}px`;
        mainContainer.style.height = `${context.mode.allocatedHeight}px`;
    }

    private checkForAliases(context: ComponentFramework.Context<IInputs>) {
        // If there is no Id or Zone column defined, then report a message to the maker
        const idColumnSet = context.parameters.items.columns.find(
            (c) => c.alias === ItemProperties.IdColumn && c.name !== null,
        );
        const zoneColumnSet = context.parameters.items.columns.find(
            (c) => c.alias === ItemProperties.ZoneColumn && c.name !== null,
        );

        const customSortPositionRequired = context.parameters.SortPositionType?.raw === SortPositionType.Custom;

        // CustomPositionColumn is only required if the sort type is CustomPosition
        const customPositionColumnSet = context.parameters.items.columns.find(
            (c) => c.alias === ItemProperties.CustomPositionColumn && c.name !== null,
        );

        if (!idColumnSet || !zoneColumnSet || (customSortPositionRequired && !customPositionColumnSet)) {
            this.renderMessage(
                `Please set both <strong>IdColumn</strong>${
                    customSortPositionRequired ? ',<strong>CustomPositionColumn</strong>' : ''
                } and <strong>ZoneColumn</strong> column aliases in the <strong>Advanced Properties</strong> panel.`,
            );
            return false;
        }
        return true;
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    public renderItems(
        context: ComponentFramework.Context<IInputs>,
        sortStrategy: ItemSortStrategy,
    ): { itemsRendered?: CurrentItem[]; sortOrder?: string[] } {
        const parameters = context.parameters;
        const dataset = context.parameters.items;
        const currentItems: CurrentItem[] = [];
        const originalOrder: string[] = [];
        const listContainer = this.listContainer;
        this.renderVersion++;
        this.listContainer.setAttribute(RENDER_VERSION_ATTRIBUTE, this.renderVersion.toString());
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
                const indexInZone = parameters.PreserveSort.raw === true ? index + 1 : zoneCounts[zone];
                const positionInZone =
                    sortStrategy.type === 'customPosition' ? this.getCustomSortPosition(record) : indexInZone;

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
        this.updateContainerFlex(parameters);

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
        const totalItems = items.length;
        for (const itemInThisZone of items) {
            const item = itemInThisZone.record;
            index++;
            const itemRow: HTMLElement = document.createElement('li');
            itemRow.classList.add(CSS_STYLE_CLASSES.Item);

            // If the sort is being preserved, the position is based on all the items rather than just the items in the zone
            const originalPositionIndex = sortStrategy.direction === 'asc' ? index : totalItems - index + 1;

            const attributes = {
                renderVersion: this.renderVersion,
                // Set the index of the item in the source dataset - this is used when we drop an item
                itemId: item.getValue(ItemProperties.IdColumn)
                    ? item.getFormattedValue(ItemProperties.IdColumn)
                    : index.toString(),
                originalZone: parameters.DropZoneID.raw,
                originalSortPosition:
                    parameters.PreserveSort.raw === true ? itemInThisZone.index : originalPositionIndex,
                originalSortPositionAttributeValue:
                    sortStrategy.type === 'customPosition' ? this.getCustomSortPosition(item) : undefined,
            } as RowHTMLAttributes;

            this.setRowAttributes(itemRow, attributes);

            // Style accordingly to the parameters
            this.styleItemElement(itemRow, parameters);

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

    private setRowAttributes(itemRow: HTMLElement, attributes: RowHTMLAttributes) {
        if (attributes.renderVersion)
            itemRow.setAttribute(RENDER_VERSION_ATTRIBUTE, attributes.renderVersion.toString());
        itemRow.setAttribute(RECORD_ID_ATTRIBUTE, attributes.itemId);
        if (attributes.originalZone) itemRow.setAttribute(ORIGINAL_ZONE_ATTRIBUTE, attributes.originalZone);
        if (attributes.originalSortPositionAttributeValue)
            itemRow.setAttribute(
                ORIGINAL_SORT_POSITION_ATTRIBUTE,
                attributes.originalSortPositionAttributeValue.toString(),
            );
        if (attributes.originalSortPosition)
            itemRow.setAttribute(ORIGINAL_POSITION_ATTRIBUTE, attributes.originalSortPosition.toString());
    }

    public getRowAttributes(itemRow: HTMLElement): RowHTMLAttributes {
        const originalSortPosition = itemRow.getAttribute(ORIGINAL_POSITION_ATTRIBUTE);
        const originalSortPositionAttributeValue = itemRow.getAttribute(ORIGINAL_SORT_POSITION_ATTRIBUTE);
        return {
            itemId: itemRow.getAttribute(RECORD_ID_ATTRIBUTE) ?? '',
            originalZone: itemRow.getAttribute(ORIGINAL_ZONE_ATTRIBUTE) ?? '',
            originalSortPosition: originalSortPosition ? parseInt(originalSortPosition) : 0,
            originalSortPositionAttributeValue: originalSortPositionAttributeValue
                ? parseFloat(originalSortPositionAttributeValue)
                : undefined,
        } as RowHTMLAttributes;
    }

    private getCustomSortPosition(item: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord) {
        return (item.getValue(ItemProperties.CustomPositionColumn) as number) ?? undefined;
    }

    private removeAllExistingElements() {
        const listContainer = this.listContainer;
        while (listContainer.firstChild && listContainer.firstChild.parentNode) {
            listContainer.removeChild(listContainer.firstChild);
        }
    }

    private getSortedFieldsOnDataset(
        context: ComponentFramework.Context<IInputs>,
    ): ComponentFramework.PropertyHelper.DataSetApi.Column[] {
        if (!context.parameters.items.columns) {
            return [];
        }
        return context.parameters.items.columns.filter((c) => c.order !== -1);
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
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
            const direction = parameters.Direction?.raw;
            const scroll = parameters.Scroll.raw === true;
            const wrap = parameters.Wrap?.raw === true;
            listContainer.style.overflowX =
                scroll && (direction !== DirectionEnum.Vertical || wrap) ? 'auto' : 'hidden';
            listContainer.style.overflowY =
                scroll && (direction !== DirectionEnum.Horizontal || wrap) ? 'auto' : 'hidden';
        }

        if (parameters.AccessibleLabel?.raw !== null) {
            listContainer.ariaLabel = parameters.AccessibleLabel.raw;
        }

        if (parameters.AllowFocus?.raw !== null) {
            listContainer.tabIndex = parameters.AllowFocus.raw ? 0 : -1;
        }
    }

    private updateContainerFlex(parameters: IInputs) {
        const listContainer = this.listContainer;
        if (parameters.Direction?.raw !== null || parameters.Wrap?.raw !== null) {
            // Set the list direction and wrap
            // Auto for standard ordered list behavior
            const direction = parameters.Direction?.raw;
            const wrap = parameters.Wrap?.raw;

            if (direction === DirectionEnum.Auto && wrap !== true) {
                listContainer.style.flexDirection = '';
                listContainer.style.flexWrap = '';
                listContainer.style.display = '';
            } else {
                listContainer.style.flexDirection = direction === DirectionEnum.Vertical ? 'column' : 'row';
                listContainer.style.flexWrap = wrap === true ? 'wrap' : 'nowrap';
                listContainer.style.display = 'flex';
            }
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
            innerDiv.textContent = item.getFormattedValue(columnItem.name);
            itemRow.appendChild(innerDiv);
        });
    }

    public renderMessage(messageHml: string): void {
        this.removeAllExistingElements();
        this.listContainer.appendChild(this.createMessageElement(messageHml));
    }

    private createMessageElement(messageHtml: string): HTMLElement {
        const element = document.createElement('div');
        element.className = CSS_STYLE_CLASSES.WarningContainer;
        element.innerHTML = `
            <div class=${CSS_STYLE_CLASSES.Warning}>
                <span class="${CSS_STYLE_CLASSES.WarningIcon}"></span><span>${messageHtml}</span>
            </div>`;
        return element;
    }
}
