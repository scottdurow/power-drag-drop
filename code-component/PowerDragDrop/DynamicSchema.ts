// The custom templates require a POJO instead of dataset record
// These functions convert and EntityRecord to a POJO
export function GetOutputObjectRecord(
    row: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord,
    fieldsOnDataset: ComponentFramework.PropertyHelper.DataSetApi.Column[],
): Record<string, string | number | boolean | number[] | undefined> {
    const outputObject: Record<string, string | number | boolean | number[] | undefined> = {};
    fieldsOnDataset.forEach((c) => {
        const value = getRowValue(row, c);
        outputObject[c.displayName || c.name] = value;
    });
    return outputObject;
}

function getRowValue(
    row: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord,
    column: ComponentFramework.PropertyHelper.DataSetApi.Column,
) {
    switch (column.dataType) {
        // Number Types
        case 'TwoOptions':
            return row.getValue(column.name) as boolean;
        case 'Whole.None':
        case 'Currency':
        case 'Decimal':
        case 'FP':
        case 'Whole.Duration':
            return row.getValue(column.name) as number;
        // String Types
        case 'SingleLine.Text':
        case 'SingleLine.Email':
        case 'SingleLine.Phone':
        case 'SingleLine.Ticker':
        case 'SingleLine.URL':
        case 'SingleLine.TextArea':
        case 'Multiple':
            return row.getFormattedValue(column.name);
        // Date Types
        case 'DateAndTime.DateOnly':
        case 'DateAndTime.DateAndTime':
            return (row.getValue(column.name) as Date)?.toISOString();
        // Choice Types
        case 'OptionSet':
            // Not supported
            return row.getFormattedValue(column.name) as string;
        case 'MultiSelectPicklist':
            return row.getValue(column.name) as number[];
        // Lookup Types
        case 'Lookup.Simple':
        case 'Lookup.Customer':
        case 'Lookup.Owner':
            // Not supported
            return (row.getValue(column.name) as ComponentFramework.EntityReference)?.id.guid;
        // Other
        case 'Whole.TimeZone':
        case 'Whole.Language':
            return row.getFormattedValue(column.name);
    }
}
