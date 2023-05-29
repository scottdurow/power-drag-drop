import debounce from 'debounce';
import Sortable, { SortableEvent } from 'sortablejs';
import { ContextExtended } from './ContextExtended';
import { CurrentItem, CurrentItemsSchema } from './CurrentItemSchema';
import { findFirstFocusableElement } from './FocusControl';
import { IInputs, IOutputs } from './generated/ManifestTypes';
import { ItemRenderer, ItemSortStrategy } from './ItemRenderer';
import {
    InputEvents,
    ItemProperties,
    ManifestConstants,
    OutputEvents,
    RENDER_TRIGGER_PROPERTIES,
    SortDirection,
    SortPositionType,
    ZONE_OPTIONS_PROPERTIES,
    ZONE_REGISTRATION_PROPERTIES,
} from './ManifestConstants';
import {
    CSS_STYLE_CLASSES,
    DRAGGED_FROM_ZONE_ATTRIBUTE,
    DRAG_INVALID,
    ORIGINAL_ZONE_ATTRIBUTE,
    RECORD_ID_ATTRIBUTE,
    RENDER_VERSION_ATTRIBUTE,
    ROTATION_CLASSES,
} from './Styles';
import { ReOrderableItem, CustomSortPositionStrategy } from './CustomSortPositionStrategy';

// Because elements get created and destroyed (e.g. gallery), we must keep checking on a timer
// because there is no way to receive messages from the controls as they are created/destroyed
// without registering a callback method in teh global scope
const REGISTER_ZONES_DEBOUNCE = 500;
const REGISTER_ZONE_TICK = 1000;
const DRAG_START_DELAY = 100;

interface RegisteredZone {
    index: number;
    zoneId: string;
    maximumItems: number | undefined;
    sortable: Sortable;
    onActionClick: (ev: MouseEvent) => void;
}

const defaultSortableOptions: Sortable.Options = {
    animation: 300,
    scrollSensitivity: 30,
    bubbleScroll: true,
    scrollSpeed: 10,
    forceFallback: true,
    fallbackOnBody: true,
    removeCloneOnHide: true,
    ghostClass: CSS_STYLE_CLASSES.Ghost,
    chosenClass: CSS_STYLE_CLASSES.Chosen,
    dataIdAttr: RECORD_ID_ATTRIBUTE,
};

export class PowerDragDrop implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private context: ContextExtended<IInputs>;
    private notifyOutputChanged: () => void;
    private zonesRegistered: Record<string, RegisteredZone> = {};
    private zoneIds: string[] = [];
    private initialZonesRegistered = false;
    private droppedId = '';
    private droppedTarget = '';
    private droppedSource = '';
    private droppedPosition? = -1;
    private currentItems: CurrentItem[];
    private originalOrder: string[];
    private scheduledEvents: Partial<Record<OutputEvents, boolean>> = {};
    private actionName: string;
    private actionItemId: string;
    private itemRenderer: ItemRenderer;
    private registerTimer: number;
    private currentItemZone: string | null = null;
    private sortablesToDestroy: Sortable[] = [];
    private disposed: boolean;
    private customSortStrategy = new CustomSortPositionStrategy();

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        _state: ComponentFramework.Dictionary,
        container: HTMLDivElement,
    ): void {
        this.context = context as ContextExtended<IInputs>;
        // Need to track container resize so that control could get the available width.
        // In Canvas-app, the available height will be provided in context.mode.allocatedHeight
        context.mode.trackContainerResize(true);
        this.notifyOutputChanged = notifyOutputChanged;
        context.parameters.items.paging.setPageSize(10000);
        this.itemRenderer = new ItemRenderer(container);
        this.registerZones = debounce(this.registerZones, REGISTER_ZONES_DEBOUNCE, true);
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this.trace(`updateView ${context.parameters.DropZoneID.raw}`, context.updatedProperties.join(' | '));
        this.context = context as ContextExtended<IInputs>;
        const parameters = context.parameters;
        const isMasterZone = this.isMasterZone();

        // Determine what has changed
        const datasetChanged = this.hasPropertyChanged([ManifestConstants.dataset]);
        const resetDatasetTriggered = this.isEventRaised(InputEvents.Reset);
        const zonesChanged = this.hasPropertyChanged(ZONE_REGISTRATION_PROPERTIES);
        const layoutChanged = this.hasPropertyChanged(['layout']);
        const syncPositionsTriggered = this.isEventRaised(InputEvents.SyncPositions);
        if (!this.itemRenderer.rendered || this.hasPropertyChanged([ManifestConstants.DropZoneID])) {
            this.setZoneId(this.itemRenderer.listContainer, parameters.DropZoneID.raw as string);
        }

        // If height/width changed, update
        if (!this.itemRenderer.rendered || layoutChanged) {
            this.itemRenderer.updateContainerSize(context);
        }

        if (isMasterZone && !this.initialZonesRegistered) {
            // Attach the sortables to the zone containers
            this.initialZonesRegistered = true;
            this.scheduleRegisterZones();
        }

        if (zonesChanged) {
            this.unregisterAllZones();
        }

        if (isMasterZone && (layoutChanged || resetDatasetTriggered || zonesChanged)) {
            this.registerZones();
        }

        if (isMasterZone && this.hasPropertyChanged(ZONE_OPTIONS_PROPERTIES)) {
            this.updateZoneProperties();
        }

        this.raiseScheduledEvents([OutputEvents.OnDropAfterSyncPositions]);

        // Even if this is not a master zone, the reset event triggers a re-render to enable items
        // to be re-created after drop
        const renderTriggerProperties = this.hasPropertyChanged(RENDER_TRIGGER_PROPERTIES);
        const updateItems =
            !this.itemRenderer.rendered ||
            resetDatasetTriggered ||
            datasetChanged ||
            renderTriggerProperties ||
            syncPositionsTriggered;

        if (!parameters.items.loading && updateItems) {
            this.trace('renderItems', { resetDatasetTriggered, datasetChanged, renderTriggerProperties });
            this.renderItems(syncPositionsTriggered);
        }

        if (this.isEventRaised(InputEvents.ClearChanges)) {
            this.trace('clearCurrentItemChanges');
            this.clearCurrentItemChanges();
        }

        this.handleFocusEvents();
        this.raiseScheduledEvents([OutputEvents.OnDrop, OutputEvents.OnAction]);
    }

    private handleFocusEvents() {
        if (this.isEventRaised(InputEvents.SetFocus)) {
            // Set focus on the whole control if possible (for a11y)
            const firstFocusableElement = findFirstFocusableElement(this.itemRenderer.listContainer, true);
            if (firstFocusableElement) firstFocusableElement.focus();
        } else if (this.isEventRaised(InputEvents.FocusItem)) {
            // Set focus on a specific drag item action if possible (For a11y)
            // Expect the Focus Item to be followed by the item id and then random element - comma separated
            const parts = this.context.parameters.InputEvent.raw?.split(',');
            if (parts && parts.length > 0) {
                const itemId = parts[1];
                this.setFocusOnItem(itemId);
            }
        }
    }

    private setFocusOnItem(itemId: string) {
        try {
            const item = this.itemRenderer.listContainer.querySelector(`li[data-id='${itemId}']`) as HTMLElement;
            if (item) {
                const firstFocusableElement = findFirstFocusableElement(item, true);
                if (firstFocusableElement) firstFocusableElement.focus();
            }
        } catch {
            //no op
        }
    }

    public async getOutputSchema(): Promise<Record<string, unknown>> {
        return Promise.resolve({
            CurrentItems: CurrentItemsSchema,
        });
    }

    public getOutputs(): IOutputs {
        const outputs = {
            DroppedId: this.droppedId,
            DroppedTarget: this.droppedTarget,
            DroppedSource: this.droppedSource,
            DroppedPosition: this.droppedPosition,
            CurrentItems: this.currentItems,
            ActionName: this.actionName,
            ActionItemId: this.actionItemId,
        };
        this.trace('getOutputs', outputs);
        return outputs;
    }

    public destroy(): void {
        this.disposed = true;
        if (this.isMasterZone()) {
            if (this.registerTimer) window.clearTimeout(this.registerTimer);
            this.unregisterAllZones();
        }
    }

    private renderItems(syncPositions = false): void {
        const renderResult = this.itemRenderer.renderItems(this.context, this.getSort());

        if (renderResult.itemsRendered && renderResult.sortOrder) {
            this.currentItems = renderResult.itemsRendered;
            this.originalOrder = renderResult.sortOrder;

            if (syncPositions) {
                // Now that the positions are forced update, we simulate the drop event
                // so that they can be picked up in the pap
                this.syncCurrentItems(true);
                this.scheduleEvent(OutputEvents.OnDropAfterSyncPositions);
            }
            if (this.isMasterZone()) {
                this.scheduleGetOutputs();
            }
        }
    }

    private getActionFromClass(target: HTMLElement) {
        return target.className.split(' ').find((c: string) => c.startsWith(CSS_STYLE_CLASSES.ActionClassPrefix));
    }

    private sortIfRequired(targetZoneId: string) {
        // If the preserve sort flag is set, then the order of the items in the input dataset
        // will define the sort of the items when dropped
        // E.g. if the dropped item appears before the items in the target zone, it will be moved to the beginning
        if (this.context.parameters.PreserveSort.raw === true) {
            this.zonesRegistered[targetZoneId].sortable.sort(this.originalOrder, true);
        }
    }

    private getSort(): ItemSortStrategy {
        return {
            // Use custom position strategy if the custom position column is set and type is 'custom'
            type:
                this.context.parameters.SortPositionType?.raw === SortPositionType.Custom &&
                this.context.parameters.items.columns.find(
                    (c) => c.alias === ItemProperties.CustomPositionColumn && c.name !== null,
                )
                    ? 'customPosition'
                    : 'index',
            direction: this.context.parameters.SortDirection?.raw === '1' ? 'desc' : 'asc',
        };
    }

    private isMasterZone(): boolean {
        return this.context.parameters.IsMasterZone.raw === true;
    }

    private getZoneId(zoneElement: HTMLElement) {
        return zoneElement.id;
    }

    private setZoneId(zoneElement: HTMLElement, idParameterValue: string) {
        zoneElement.id = this.removeSpaces(idParameterValue);
    }

    private findZoneById(zoneId: string) {
        return document.getElementById(this.removeSpaces(zoneId)) as HTMLElement | null;
    }

    private syncCurrentItems(forceUpdate = false) {
        // Two strategies - simple index based or custom position value based
        // If custom position, when items are moved they must have their position removed
        // so they do not shift the other items

        const sort = this.getSort();
        this.trace('syncCurrentItems', sort);
        if (sort.type === 'customPosition') {
            this.syncCurrentItemsCustomPosition(sort.direction);
        } else this.syncCurrentItemsInternalIndex(forceUpdate);

        this.scheduleGetOutputs();
    }

    private syncCurrentItemsCustomPosition(direction: 'asc' | 'desc') {
        /*
        When using a custom sort position, the sort position is stored in the data source
        rather than using the index of the items in the drop zone. 
        This reduces the number of updates required, because if a moved item shifts other items
        the sort position can be updated without having to update all the other items in the drop zone.
        */

        this.currentItems = [];

        // Get the items from each dropzone and work out the new custom sort position
        Object.entries(this.zonesRegistered).forEach((sortable) => {
            const children = sortable[1].sortable.el.children;
            const itemCount = children.length;
            const reOrderableItems: ReOrderableItem[] = [];
            // For each item, create a reOrderableItem setting the previous custom sort position
            for (let i = 0; i <= itemCount; i++) {
                const itemElement = sortable[1].sortable.el.children.item(i);

                if (itemElement) {
                    const itemAttributes = this.itemRenderer.getRowAttributes(itemElement as HTMLElement);

                    reOrderableItems.push({
                        DropZoneId: sortable[0],
                        ItemId: itemAttributes.itemId,
                        OriginalPosition: itemAttributes.originalSortPositionAttributeValue,
                        OriginalDropZoneId: itemAttributes.originalZone,
                    });
                }
            }
            // update the new sort position where items are out of sequence
            this.customSortStrategy.SetOptions({
                positionIncrement: this.context.parameters.CustomSortIncrement?.raw ?? 1000,
                sortOrder: direction,
                allowNegative: this.context.parameters.CustomSortAllowNegative?.raw ?? true,
                minimumIncrement: this.context.parameters.CustomSortMinIncrement?.raw ?? 10,
            });
            this.customSortStrategy.updateSortPosition(reOrderableItems);

            // Add the updated items to the currentItems output dataset
            reOrderableItems.forEach((item) => {
                this.currentItems.push({
                    DropZoneId: item.DropZoneId,
                    ItemId: item.ItemId,
                    Position: item.Position as number,
                    OriginalPosition: item.OriginalPosition as number,
                    OriginalDropZoneId: item.OriginalDropZoneId,
                    HasMovedPosition: item.HasMovedPosition === true,
                    HasMovedZone: item.HasMovedZone === true,
                });
            });
        });
    }

    private syncCurrentItemsInternalIndex(forceUpdate = false) {
        /*
        This strategy simply uses the position index of the item in the drop zone as its sort position.
        This means when items are dropped or moved, they can shift and cause updates to multiple other items
        */

        this.currentItems = [];
        Object.entries(this.zonesRegistered).forEach((sortable) => {
            const children = sortable[1].sortable.el.children;
            const itemCount = children.length;
            for (let i = 0; i <= itemCount; i++) {
                const itemElement = sortable[1].sortable.el.children.item(i);

                if (itemElement) {
                    const itemAttributes = this.itemRenderer.getRowAttributes(itemElement as HTMLElement);

                    // If the sort is being preserved, the position is based on all the items rather than just the items in the zone
                    const positionIndex =
                        this.context.parameters.SortDirection?.raw === SortDirection.Ascending ? i + 1 : itemCount - i;
                    const position =
                        this.context.parameters.PreserveSort.raw === true
                            ? itemAttributes.originalSortPosition
                            : positionIndex;
                    this.currentItems.push({
                        DropZoneId: sortable[0],
                        ItemId: itemAttributes.itemId,
                        Position: position,
                        OriginalPosition: itemAttributes.originalSortPosition,
                        OriginalDropZoneId: itemAttributes.originalZone,
                        HasMovedPosition: forceUpdate || itemAttributes.originalSortPosition !== position,
                        HasMovedZone: forceUpdate || itemAttributes.originalZone !== sortable[0],
                    });
                }
            }
        });
    }

    private clearCurrentItemChanges() {
        this.currentItems.forEach((i) => {
            i.HasMovedZone = false;
            i.HasMovedPosition = false;
            i.OriginalPosition = i.Position;
            i.OriginalDropZoneId = i.DropZoneId;
        });
        this.scheduleGetOutputs();
    }

    private isEventScheduled(eventName: OutputEvents) {
        return this.scheduledEvents[eventName] || false;
    }

    private scheduleEvent(eventName: OutputEvents, scheduled = true) {
        if (scheduled) this.trace('Scheduling Event', eventName);
        this.scheduledEvents[eventName] = scheduled;
    }

    private scheduleGetOutputs() {
        this.trace('notifyOutputChanged');
        this.notifyOutputChanged();
    }

    private raiseScheduledEvents(events: OutputEvents[]) {
        // Raise the OnDrop event if required - this is done after the output parameters are updated
        if (events.includes(OutputEvents.OnDrop) && this.isEventScheduled(OutputEvents.OnDrop)) {
            this.scheduleEvent(OutputEvents.OnDrop, false);
            this.trace('Raise OnDrop');
            this.context.events.OnDrop();
        }

        if (
            events.includes(OutputEvents.OnDropAfterSyncPositions) &&
            this.isEventScheduled(OutputEvents.OnDropAfterSyncPositions)
        ) {
            this.scheduleEvent(OutputEvents.OnDropAfterSyncPositions, false);
            this.trace('Raise OnDrop');
            this.context.events.OnDrop();
        }

        // Raise the OnAction event if required - this is done after the output parameters are updated
        if (events.includes(OutputEvents.OnAction) && this.isEventScheduled(OutputEvents.OnAction)) {
            this.scheduleEvent(OutputEvents.OnAction, false);
            this.trace('Raise OnAction');
            this.context.events.OnAction();
        }
    }

    private hasPropertyChanged(propertyNames: string[]) {
        return this.context.updatedProperties.findIndex((value) => propertyNames.includes(value)) > -1;
    }

    private isEventRaised(eventName: string) {
        return (
            this.hasPropertyChanged([ManifestConstants.InputEvent]) &&
            this.context.parameters.InputEvent.raw?.startsWith(eventName)
        );
    }

    private async scheduleRegisterZones() {
        this.registerTimer = window.setTimeout(() => {
            this.registerZones();
            // If control has not been destroyed, run again
            if (this && !this.disposed) this.scheduleRegisterZones();
        }, REGISTER_ZONE_TICK);
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    private registerZones(): boolean {
        const { parameters } = this.context;
        const masterDropZoneId = this.removeSpaces(parameters.DropZoneID.raw ?? 'dropZone');
        this.zoneIds = [];

        // Get the other zone Ids to register - remove spaces
        const otherZones = parameters.OtherDropZoneIDs.raw ?? '';
        this.zoneIds = otherZones !== '' ? this.removeSpaces(otherZones).split(',') : [];

        // Get the other containers - we need to do this each update as the other drop zones may not have been build the last time
        const containerElements: (HTMLElement | null)[] = [this.itemRenderer.listContainer];
        for (const container of this.zoneIds) {
            const containerElement = this.findZoneById(container);
            // The container may be not found because it's not created yet or has been scrolled off screen
            containerElements.push(containerElement ?? null);
        }

        // Add this master zone at the start
        this.zoneIds = [masterDropZoneId, ...this.zoneIds];
        const maximumItems = this.getMaximumItems();

        // Add sortables
        containerElements.forEach((zoneElement, index) => {
            const zoneId = this.zoneIds[index];
            const existingZoneRegistration = this.zonesRegistered[zoneId];

            // If the element for this zone has changed it will need re-registering
            const registeredOnDifferentElement =
                zoneElement !== null &&
                existingZoneRegistration &&
                existingZoneRegistration.sortable.el !== zoneElement;

            // Check if the zone was previously registered, but it is has been removed from the DOM
            if (registeredOnDifferentElement) {
                // Unregister
                this.trace('registerZones DESTROY', zoneId);
                this.unRegisterZone(zoneId);
            }

            if (zoneElement !== null && (!existingZoneRegistration || registeredOnDifferentElement)) {
                this.trace('registerZones CREATE', zoneId);
                const sortable = new Sortable(zoneElement, {
                    ...this.getDynamicSortableOptions(),
                    group: masterDropZoneId,
                    onChoose: this.onChoose,
                    onUnchoose: this.onUnChoose,
                    onEnd: this.onEnd,
                    onMove: this.onMove,
                    onClone: this.onClone,
                    filter: this.actionFilter,
                });
                const zoneRegistration = {
                    zoneId: zoneId,
                    index: index,
                    maximumItems: maximumItems[index],
                    onActionClick: (ev: MouseEvent) => {
                        this.actionClick(ev, zoneElement);
                    },
                    sortable: sortable,
                };
                this.zonesRegistered[zoneId] = zoneRegistration;
                zoneElement.addEventListener('click', zoneRegistration.onActionClick);
            }
        });

        // Remove any previous zone registrations that are no longer included in the zoneIds
        // Provided they have actually been registered
        for (const containerId in this.zonesRegistered) {
            if (this.zoneIds.indexOf(containerId) === -1 && containerId !== masterDropZoneId) {
                this.trace('registerZones REMOVE', containerId);
                this.unRegisterZone(containerId);
            }
        }
        return true;
    }

    private getDynamicSortableOptions() {
        const rotation = parseInt(this.context.parameters.RotateOnDrag.raw ?? '0');
        const dragClass = rotation > 0 ? ROTATION_CLASSES[rotation - 1] : CSS_STYLE_CLASSES.Drag;
        return {
            ...defaultSortableOptions,
            scroll: this.context.parameters.Scroll?.raw === true,
            sort: this.context.parameters.PreserveSort?.raw !== true,
            dragClass: dragClass,
            delay: this.context.parameters.DelaySelect?.raw !== '0' ? DRAG_START_DELAY : undefined,
            delayOnTouchOnly: this.context.parameters.DelaySelect?.raw === '2' ? true : false,
        } as Sortable.Options;
    }

    private unregisterAllZones() {
        Object.keys(this.zonesRegistered).forEach((z) => this.unRegisterZone(z));
        this.garbageCollect();
    }

    private garbageCollect() {
        this.trace(`garbageCollect ${this.sortablesToDestroy.length}`);
        this.sortablesToDestroy.forEach((s) => s.destroy());
        this.sortablesToDestroy = [];
    }

    private unRegisterZone(zoneId: string) {
        const zone = this.zonesRegistered[zoneId];
        // Prevent un-registering a zone if there is currently a drag happening
        if (this.currentItemZone === null) {
            try {
                zone.sortable.destroy();
                if (zone.sortable.el) zone.sortable.el.removeEventListener('click', zone.onActionClick);
            } catch (e) {
                this.trace('unRegisterZone Error', e);
            }
        } else {
            this.sortablesToDestroy.push(zone.sortable);
        }
        delete this.zonesRegistered[zoneId];
    }

    private updateZoneProperties() {
        const maxItems = this.getMaximumItems();
        Object.entries(this.zonesRegistered).forEach((entry) => {
            const zone = entry[1];
            const zoneIndex = this.zoneIds.indexOf(zone.zoneId);
            if (zoneIndex > -1) {
                zone.maximumItems = maxItems[zoneIndex];
                const zoneOptions = this.getDynamicSortableOptions();
                zone.sortable.option('dragClass', zoneOptions.dragClass);
                zone.sortable.option('sort', zoneOptions.sort);
                zone.sortable.option('scroll', zoneOptions.scroll);
            }
        });
    }

    private getMaximumItems() {
        // The number of items in each zone is specified as a comma separated list of numbers
        // the number of items must match the zone count (including the master zone)
        // -1 means that any number of items can be included
        const maximumItemsList = this.context.parameters.MaximumItems.raw ?? '';
        const maximumItems = this.removeSpaces(maximumItemsList).split(',');
        return maximumItems.map((i) => {
            const maxItemsForZone = parseInt(i);
            return maxItemsForZone && maxItemsForZone > 0 ? maxItemsForZone : undefined;
        });
    }

    private trace(message: string, ...data: unknown[]) {
        if (this.context.parameters.Trace?.raw === true) {
            console.debug('PowerDragDrop:', message, data);
        }
    }

    private removeSpaces(input: string) {
        return input.replace(/\s/gi, '');
    }

    onMove = (event: Sortable.MoveEvent): boolean | void | 1 | -1 => {
        // Check if we have reached the maximum items for the drop zone
        if (event.to) {
            const targetZoneId = this.getZoneId(event.to as HTMLElement);
            const sourceZoneId = this.getZoneId(event.from as HTMLElement);
            const targetZone = this.zonesRegistered[targetZoneId];
            const sourceZone = this.zonesRegistered[sourceZoneId];
            // Check if the source zone has re-rendered - if so this item is invalid
            const sourceZoneRenderVersion = sourceZone.sortable.el.getAttribute(RENDER_VERSION_ATTRIBUTE);
            const draggedRenderVersion = event.dragged.getAttribute(RENDER_VERSION_ATTRIBUTE);
            const originalZone = event.dragged.getAttribute(ORIGINAL_ZONE_ATTRIBUTE);
            const invalidDrag = Sortable.utils.is(event.dragged, '.' + DRAG_INVALID);
            if (invalidDrag) {
                this.trace('onMove - Invalid drag item');
                return false;
            }
            if (sourceZoneRenderVersion !== draggedRenderVersion && originalZone === sourceZoneId) {
                this.trace('onMove - Render version mismatch');
                return false;
            }
            if (targetZone && targetZone.maximumItems && targetZone.maximumItems > 0) {
                const currentItemCount = targetZone.sortable.toArray().length;
                return currentItemCount < targetZone.maximumItems;
            }
        }
    };

    onClone = (event: SortableEvent): void => {
        const origEl = event.item;
        const invalidDragItem = !origEl.parentElement;
        Sortable.utils.toggleClass(origEl, DRAG_INVALID, invalidDragItem);
        if (invalidDragItem) {
            // The item being dragged has no parent container since the zone has been removed
            // or the items have been re-rendered. This makes the drag item invalid
            origEl.style.display = 'none';
            this.trace('onClone -Invalid drag');
        }
    };

    onEnd = (event: SortableEvent): void => {
        try {
            const draggedElement = event.item; // dragged HTMLElement
            const targetZone = event.to; // target list
            const sourceZone = event.from; // previous list

            // Check if there is an invalid item being dragged
            // and prevent it being dropped anywhere
            if (Sortable.utils.is(draggedElement, '.' + DRAG_INVALID)) {
                this.trace('onEnd - Invalid drop');
                return;
            }

            const newPosition = event.newDraggableIndex; // element's new index within new parent, only counting draggable elements
            const itemId = draggedElement.getAttribute(RECORD_ID_ATTRIBUTE) as string;
            const targetZoneId = this.getZoneId(targetZone);
            const sourceZoneId = this.getZoneId(sourceZone);

            this.droppedPosition = newPosition;
            this.droppedTarget = targetZoneId;
            this.droppedSource = sourceZoneId;
            this.droppedId = itemId;
            const currentItemsBefore = [...this.currentItems];

            // If the items are not sortable
            this.sortIfRequired(targetZoneId);

            // Sync all the items to the current items
            this.syncCurrentItems();

            this.trace(`drop id:${this.droppedId} position:${newPosition}`, currentItemsBefore, this.currentItems);
            this.scheduleEvent(OutputEvents.OnDrop);

            this.garbageCollect();
        } catch (e) {
            this.itemRenderer.renderMessage('Error:' + JSON.stringify(e));
        }
    };

    onUnChoose = (event: SortableEvent): void => {
        this.currentItemZone = null;
        this.trace('onUnChoose', this.context.parameters.DropZoneID.raw, event.item.innerText);
        event.item.removeAttribute(DRAGGED_FROM_ZONE_ATTRIBUTE);
    };

    onChoose = (event: SortableEvent): void => {
        this.currentItemZone = this.getZoneId(event.from);
        this.trace('onChoose', this.context.parameters.DropZoneID.raw, event.item.innerText);
        event.item.setAttribute(DRAGGED_FROM_ZONE_ATTRIBUTE, this.currentItemZone);
    };

    actionFilter = (event: Event | TouchEvent): boolean => {
        // Action buttons have a class that is prefixed with 'action-'
        const targetElement = event.target as HTMLElement;
        if (targetElement && targetElement.className) {
            return this.getActionFromClass(targetElement) !== undefined;
        }
        return false;
    };

    actionClick = (ev: MouseEvent, zoneElement: HTMLElement): void => {
        // For accessibility, action elements raise the OnAction event here
        // rather than the onFilter event which only fires for touch events
        if (ev.target && (ev.target as HTMLElement).className) {
            const actionName = this.getActionFromClass(ev.target as HTMLElement);
            // Actions have a class prefixed with action-
            if (actionName) {
                // Find the closest sortable item using the item class identifier
                const element = Sortable.utils.closest(
                    ev.target as HTMLElement,
                    '.' + CSS_STYLE_CLASSES.Item,
                    zoneElement,
                );
                if (element) {
                    // Get the item id from the data attribute
                    const actionItemId = element.getAttribute(RECORD_ID_ATTRIBUTE);
                    if (actionItemId) {
                        this.scheduleEvent(OutputEvents.OnAction);
                        // Remove the action specifier and raise the event
                        this.actionName = actionName.replace(CSS_STYLE_CLASSES.ActionClassPrefix, '');
                        this.actionItemId = actionItemId;
                        this.scheduleGetOutputs();
                    }
                }
            }
        }
    };
}
