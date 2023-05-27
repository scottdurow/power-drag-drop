export enum ItemProperties {
    IdColumn = 'IdColumn',
    ZoneColumn = 'ZoneColumn',
    CustomPositionColumn = 'CustomPositionColumn',
}

export enum ManifestConstants {
    RotateOnDrag = 'RotateOnDrag',
    DropZoneID = 'DropZoneID',
    dataset = 'dataset',
    PreserveSort = 'PreserveSort',
    OtherDropZoneIDs = 'OtherDropZoneIDs',
    IsMasterZone = 'IsMasterZone',
    ItemBackgroundColor = 'ItemBackgroundColor',
    ItemFontSize = 'ItemFontSize',
    ItemFontColor = 'ItemFontColor',
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
    ItemGap = 'ItemGap',
    Direction = 'Direction',
    Wrap = 'Wrap',
    AccessibleLabel = 'AccessibleLabel',
    AllowFocus = 'AllowFocus',
    SortPositionType = 'SortPositionType',
}

export enum InputEvents {
    Reset = 'Reset',
    ClearChanges = 'ClearChanges',
    SetFocus = 'SetFocus',
    FocusItem = 'FocusItem',
    SyncPositions = 'SyncPositions',
}

export enum OutputEvents {
    OnDrop = 'OnDrop',
    OnAction = 'OnAction',
    OnDropAfterSyncPositions = 'OnDropAfterSyncPositions',
}

export const RENDER_TRIGGER_PROPERTIES: string[] = [
    ManifestConstants.DropZoneID,
    ManifestConstants.OtherDropZoneIDs,
    ManifestConstants.IsMasterZone,
    ManifestConstants.BackgroundColor,
    ManifestConstants.BorderRadius,
    ManifestConstants.BorderColor,
    ManifestConstants.BorderWidth,
    ManifestConstants.ItemBackgroundColor,
    ManifestConstants.ItemFont,
    ManifestConstants.ItemFontSize,
    ManifestConstants.ItemFontColor,
    ManifestConstants.ItemBorderColor,
    ManifestConstants.ItemBorderWidth,
    ManifestConstants.ItemBorderRadius,
    ManifestConstants.ItemGap,
    ManifestConstants.ItemTemplate,
    ManifestConstants.PaddingRight,
    ManifestConstants.PaddingLeft,
    ManifestConstants.PaddingTop,
    ManifestConstants.PaddingBottom,
    ManifestConstants.Scroll,
    ManifestConstants.Direction,
    ManifestConstants.Wrap,
    ManifestConstants.AccessibleLabel,
    ManifestConstants.AllowFocus,
    ManifestConstants.DelaySelect,
    ManifestConstants.SortPositionType,
];

export const ZONE_REGISTRATION_PROPERTIES: string[] = [
    ManifestConstants.IsMasterZone,
    ManifestConstants.DropZoneID,
    ManifestConstants.OtherDropZoneIDs,
    ManifestConstants.DelaySelect,
];

export const ZONE_OPTIONS_PROPERTIES: string[] = [
    ManifestConstants.RotateOnDrag,
    ManifestConstants.MaximumItems,
    ManifestConstants.Scroll,
    ManifestConstants.DelaySelect,
    ManifestConstants.PreserveSort,
];

export enum DirectionEnum {
    Auto = '0',
    Vertical = '1',
    Horizontal = '2',
}

export enum SortPositionType {
    Index = '0',
    Custom = '1',
}
