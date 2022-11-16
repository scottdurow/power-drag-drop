export enum ItemProperties {
    IdColumn = 'IdColumn',
    ZoneColumn = 'ZoneColumn',
}

export enum ManifestConstants {
    RotateOnDrag = 'RotateOnDrag',
    DropZoneID = 'DropZoneID',
    dataset = 'dataset',
    PreserveSort = 'PreserveSort',
    OtherDropZoneIDs = 'OtherDropZoneIDs',
    IsMasterZone = 'IsMasterZone',
    ItemBackgroundColour = 'ItemBackgroundColour',
    ItemFontSize = 'ItemFontSize',
    ItemFontColour = 'ItemFontColour',
    MaximumItems = 'MaximumItems',
    InputEvent = 'InputEvent',
    Scroll = 'Scroll',
    ItemTemplate = 'ItemTemplate',
    PaddingRight = 'PaddingRight',
    PaddingLeft = 'PaddingLeft',
    PaddingTop = 'PaddingTop',
    PaddingBottom = 'PaddingBottom',
    BackgroundColor = 'BackgroundColor',
    BorderColor = 'BorderColor',
    BorderWidth = 'BorderWidth',
    BorderRadius = 'BorderRadius',
    ItemBorderColor = 'ItemBorderColor',
    ItemBorderWidth = 'ItemBorderWidth',
    ItemBorderRadius = 'ItemBorderRadius',
    ItemFont = 'ItemFont',
    DelaySelect = 'DelaySelect',
}

export enum InputEvents {
    Reset = 'Reset',
    ClearChanges = 'ClearChanges',
}

export const RENDER_TRIGGER_PROPERTIES: string[] = [
    ManifestConstants.DropZoneID,
    ManifestConstants.OtherDropZoneIDs,
    ManifestConstants.IsMasterZone,
    ManifestConstants.BackgroundColor,
    ManifestConstants.BorderRadius,
    ManifestConstants.BorderColor,
    ManifestConstants.BorderWidth,
    ManifestConstants.ItemBackgroundColour,
    ManifestConstants.ItemFont,
    ManifestConstants.ItemFontSize,
    ManifestConstants.ItemFontColour,
    ManifestConstants.ItemBorderColor,
    ManifestConstants.ItemBorderWidth,
    ManifestConstants.ItemBorderRadius,
    ManifestConstants.ItemTemplate,
    ManifestConstants.PaddingRight,
    ManifestConstants.PaddingLeft,
    ManifestConstants.PaddingTop,
    ManifestConstants.PaddingBottom,
    ManifestConstants.Scroll,
];

export const ZONE_REGISTRATION_PROPERTIES: string[] = [
    ManifestConstants.IsMasterZone,
    ManifestConstants.DropZoneID,
    ManifestConstants.OtherDropZoneIDs,
];

export const ZONE_OPTIONS_PROPERTIES: string[] = [
    ManifestConstants.RotateOnDrag,
    ManifestConstants.MaximumItems,
    ManifestConstants.Scroll,
    ManifestConstants.DelaySelect,
];
