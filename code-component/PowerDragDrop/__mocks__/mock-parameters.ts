/* istanbul ignore file */

import { IInputs } from '../generated/ManifestTypes';
import { ItemProperties } from '../ManifestConstants';
import {
    MockDecimalProperty,
    MockEnumProperty,
    MockStringProperty,
    MockTwoOptionsProperty,
    MockWholeNumberProperty,
} from './mock-context';
import { MockDataSet } from './mock-datasets';

export function getMockParameters(): IInputs {
    const items = new MockDataSet([]);
    // The Alias columns are needed to render
    items.columns.push({
        alias: ItemProperties.ZoneColumn,
        name: ItemProperties.ZoneColumn,
        displayName: '',
        order: -1,
        visualSizeFactor: 0,
        dataType: 'string',
    });
    items.columns.push({
        alias: ItemProperties.IdColumn,
        name: ItemProperties.IdColumn,
        displayName: '',
        order: -1,
        visualSizeFactor: 0,
        dataType: 'string',
    });
    return {
        DropZoneID: new MockStringProperty('zone1'),
        OtherDropZoneIDs: new MockStringProperty(''),
        IsMasterZone: new MockTwoOptionsProperty(false),
        MaximumItems: new MockStringProperty(''),
        InputEvent: new MockStringProperty(''),
        BackgroundColor: new MockStringProperty(''),
        BorderColor: new MockStringProperty(''),
        BorderWidth: new MockDecimalProperty(0),
        BorderRadius: new MockDecimalProperty(0),
        ItemBackgroundColor: new MockStringProperty(''),
        ItemFont: new MockStringProperty(''),
        ItemFontSize: new MockDecimalProperty(0),
        ItemFontColor: new MockStringProperty(''),
        ItemBorderRadius: new MockDecimalProperty(0),
        ItemBorderWidth: new MockDecimalProperty(0),
        ItemBorderColor: new MockStringProperty(''),
        ItemGap: new MockWholeNumberProperty(0),
        ItemTemplate: new MockStringProperty(''),
        PaddingLeft: new MockWholeNumberProperty(0),
        PaddingRight: new MockWholeNumberProperty(0),
        PaddingTop: new MockWholeNumberProperty(0),
        PaddingBottom: new MockWholeNumberProperty(0),
        RotateOnDrag: new MockEnumProperty<'0' | '1' | '2' | '3' | '4'>('0'),
        PreserveSort: new MockTwoOptionsProperty(false),
        Direction: new MockEnumProperty<'0' | '1' | '2'>('0'),
        Wrap: new MockTwoOptionsProperty(false),
        Scroll: new MockTwoOptionsProperty(false),
        DelaySelect: new MockEnumProperty<'0' | '1' | '2'>('0'),
        Trace: new MockTwoOptionsProperty(false),
        ItemSchema: new MockStringProperty(''),
        items: items,
        AccessibleLabel: new MockStringProperty(''),
        AllowFocus: new MockTwoOptionsProperty(false),
    };
}
