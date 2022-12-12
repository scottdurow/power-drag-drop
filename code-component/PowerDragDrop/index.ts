import debounce from 'debounce';
import Sortable, { SortableEvent } from 'sortablejs';
import { ContextExtended } from './ContextExtended';
import { CurrentItem, CurrentItemsSchema } from './CurrentItemSchema';
import { IInputs, IOutputs } from './generated/ManifestTypes';
import { ItemRenderer } from './ItemRenderer';
import {
    InputEvents,
    ManifestConstants,
    RENDER_TRIGGER_PROPERTIES,
    ZONE_OPTIONS_PROPERTIES,
    ZONE_REGISTRATION_PROPERTIES,
} from './ManifestConstants';
import {
    CSS_STYLE_CLASSES,
    DRAGGED_FROM_ZONE_ATTRIBUTE,
    DRAG_INVALID,
    ORIGINAL_POSITION_ATTRIBUTE,
    ORIGINAL_ZONE_ATTRIBUTE,
    RECORD_ID_ATTRIBUTE,
    RENDER_VERSION_ATTRIBUTE,
    ROTATION_CLASSES,
} from './Styles';

// Because elements get created and destroyed (e.g. gallery), we must keep checking on a timer
// because there is no way to receive messages from the controls as they are created/destroyed
// without registering a callback method in teh global scope
const REGISTER_ZONES_DEBOUNCE = 500;
const REGISTER_ZONE_TICK = 1000;

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
    delay: 100,
    delayOnTouchOnly: true,
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
    private raiseOnDropScheduled: boolean;
    private raiseOnActionScheduled: boolean;
    private actionName: string;
    private actionItemId: string;
    private itemRenderer: ItemRenderer;
    private registerTimer: number;
    private currentItemZone: string | null = null;
    private sortablesToDestroy: Sortable[] = [];
    private disposed: boolean;

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
        this.trace('updateView', context.parameters.DropZoneID, context.updatedProperties);
        this.context = context as ContextExtended<IInputs>;
        const parameters = context.parameters;
        const isMasterZone = this.isMasterZone();

        // Determine what has changed
        const datasetChanged = this.hasPropertyChanged([ManifestConstants.dataset]);
        const resetDatasetTriggered = this.isEventRaised(InputEvents.Reset);
        const clearChangesTriggered = this.isEventRaised(InputEvents.ClearChanges);
        const zonesChanged = this.hasPropertyChanged(ZONE_REGISTRATION_PROPERTIES);
        const layoutChanged = this.hasPropertyChanged(['layout']);
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

        // Event if this is not a master zone, the reset event triggers a re-render to enable items
        // to be re-created after drop
        const renderTriggerProperties = this.hasPropertyChanged(RENDER_TRIGGER_PROPERTIES);
        const updateItems =
            !this.itemRenderer.rendered || resetDatasetTriggered || datasetChanged || renderTriggerProperties;

        if (!parameters.items.loading && updateItems) {
            this.trace('renderItems', { resetDatasetTriggered, datasetChanged, renderTriggerProperties });
            this.renderItems();
        }

        if (clearChangesTriggered) {
            this.clearCurrentItemChanges();
        }

        this.raiseEvents();
    }

    public async getOutputSchema(): Promise<Record<string, unknown>> {
        return Promise.resolve({
            CurrentItems: CurrentItemsSchema,
        });
    }

    public getOutputs(): IOutputs {
        return {
            DroppedId: this.droppedId,
            DroppedTarget: this.droppedTarget,
            DroppedSource: this.droppedSource,
            DroppedPosition: this.droppedPosition,
            CurrentItems: this.currentItems,
            ActionName: this.actionName,
            ActionItemId: this.actionItemId,
        };
    }

    public destroy(): void {
        this.disposed = true;
        if (this.isMasterZone()) {
            if (this.registerTimer) window.clearTimeout(this.registerTimer);
            this.unregisterAllZones();
        }
    }

    private renderItems(): void {
        const renderResult = this.itemRenderer.renderItems(this.context);
        if (renderResult.itemsRendered && renderResult.sortOrder) {
            this.currentItems = renderResult.itemsRendered;
            this.originalOrder = renderResult.sortOrder;

            if (this.isMasterZone()) {
                this.notifyOutputChanged();
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

    private syncCurrentItems() {
        this.currentItems = [];
        Object.entries(this.zonesRegistered).forEach((sortable) => {
            const children = sortable[1].sortable.el.children;
            const itemCount = children.length;
            for (let i = 0; i <= itemCount; i++) {
                const itemElement = sortable[1].sortable.el.children.item(i);

                if (itemElement) {
                    const itemId = itemElement?.getAttribute(RECORD_ID_ATTRIBUTE) as string;
                    const originalPosition = parseInt(itemElement?.getAttribute(ORIGINAL_POSITION_ATTRIBUTE) as string);
                    const originalZone = itemElement?.getAttribute(ORIGINAL_ZONE_ATTRIBUTE) as string;
                    // If the sort is being preserved, the position is based on all the items rather than just the items in the zone
                    const position = this.context.parameters.PreserveSort.raw === true ? originalPosition : i + 1;
                    this.currentItems.push({
                        DropZoneId: sortable[0],
                        ItemId: itemId,
                        Position: position,
                        OriginalPosition: originalPosition,
                        OriginalDropZoneId: originalZone,
                        HasMovedPosition: originalPosition !== position,
                        HasMovedZone: originalZone !== sortable[0],
                    });
                }
            }
        });
        this.notifyOutputChanged();
    }

    private clearCurrentItemChanges() {
        this.currentItems.forEach((i) => {
            i.HasMovedZone = false;
            i.HasMovedPosition = false;
            i.OriginalPosition = i.Position;
            i.OriginalDropZoneId = i.DropZoneId;
        });
        this.notifyOutputChanged();
    }

    private raiseEvents() {
        // Raise the OnDrop event if required - this is done after the output parameters are updated
        if (this.raiseOnDropScheduled) {
            this.raiseOnDropScheduled = false;
            this.context.events.OnDrop();
        }

        // Raise the OnAction event if required - this is done after the output parameters are updated
        if (this.raiseOnActionScheduled) {
            this.raiseOnActionScheduled = false;
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
            delay: this.context.parameters.DelaySelect?.raw !== '0' ? 200 : 0,
            delayOnTouchOnly: this.context.parameters.DelaySelect?.raw === '2',
        } as Sortable.Options;
    }

    private unregisterAllZones() {
        Object.keys(this.zonesRegistered).forEach((z) => this.unRegisterZone(z));
        this.garbageCollect();
    }

    private garbageCollect() {
        this.sortablesToDestroy.forEach((s) => s.destroy());
        this.sortablesToDestroy = [];
    }

    private unRegisterZone(zoneId: string) {
        const zone = this.zonesRegistered[zoneId];
        // Prevent un-registering a zone if there is currently a drag happening
        if (this.currentItemZone === null) {
            try {
                zone.sortable.destroy();
                zone.sortable.el.removeEventListener('click', zone.onActionClick);
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
            this.raiseOnDropScheduled = true;

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
                        this.raiseOnActionScheduled = true;
                        // Remove the action specifier and raise the event
                        this.actionName = actionName.replace(CSS_STYLE_CLASSES.ActionClassPrefix, '');
                        this.actionItemId = actionItemId;
                        this.notifyOutputChanged();
                    }
                }
            }
        }
    };
}
