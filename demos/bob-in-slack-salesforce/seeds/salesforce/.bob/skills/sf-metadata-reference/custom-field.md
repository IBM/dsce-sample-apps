# Custom field

Source path: `force-app/main/default/objects/<Object>/fields/<Field__c>.field-meta.xml`,
one file per field, on a standard object (`Opportunity`) or a custom one
(`Success_Plan__c`). `fullName` is the field API name and must equal the file
name. Children after `fullName` are alphabetical.

## Date

```xml
<!-- force-app/main/default/objects/Opportunity/fields/Ref_Go_Live__c.field-meta.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Ref_Go_Live__c</fullName>
    <description>Reference example: planned go-live date.</description>
    <externalId>false</externalId>
    <label>Go Live</label>
    <required>false</required>
    <trackTrending>false</trackTrending>
    <type>Date</type>
</CustomField>
```

## Text

```xml
<!-- force-app/main/default/objects/Opportunity/fields/Ref_Region_Code__c.field-meta.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Ref_Region_Code__c</fullName>
    <externalId>false</externalId>
    <label>Region Code</label>
    <length>20</length>
    <required>false</required>
    <trackTrending>false</trackTrending>
    <type>Text</type>
    <unique>false</unique>
</CustomField>
```

## Checkbox

```xml
<!-- force-app/main/default/objects/Opportunity/fields/Ref_Handoff_Done__c.field-meta.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Ref_Handoff_Done__c</fullName>
    <defaultValue>false</defaultValue>
    <externalId>false</externalId>
    <label>Handoff Done</label>
    <trackTrending>false</trackTrending>
    <type>Checkbox</type>
</CustomField>
```

## Lookup to a user

```xml
<!-- force-app/main/default/objects/Opportunity/fields/Ref_Executive_Sponsor__c.field-meta.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Ref_Executive_Sponsor__c</fullName>
    <deleteConstraint>SetNull</deleteConstraint>
    <externalId>false</externalId>
    <label>Executive Sponsor</label>
    <referenceTo>User</referenceTo>
    <relationshipName>Ref_Sponsored_Opportunities</relationshipName>
    <required>false</required>
    <trackTrending>false</trackTrending>
    <type>Lookup</type>
</CustomField>
```

For a lookup to any other object add `<relationshipLabel>Sponsored
Opportunities</relationshipLabel>` after `referenceTo`; `User` lookups have
no related list, so no label.

## Picklist

```xml
<!-- force-app/main/default/objects/Opportunity/fields/Ref_Risk_Level__c.field-meta.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Ref_Risk_Level__c</fullName>
    <externalId>false</externalId>
    <label>Risk Level</label>
    <required>false</required>
    <trackTrending>false</trackTrending>
    <type>Picklist</type>
    <valueSet>
        <restricted>true</restricted>
        <valueSetDefinition>
            <sorted>false</sorted>
            <value>
                <fullName>Low</fullName>
                <default>true</default>
                <label>Low</label>
            </value>
            <value>
                <fullName>Medium</fullName>
                <default>false</default>
                <label>Medium</label>
            </value>
            <value>
                <fullName>High</fullName>
                <default>false</default>
                <label>High</label>
            </value>
        </valueSetDefinition>
    </valueSet>
</CustomField>
```

## Number and currency

```xml
<!-- force-app/main/default/objects/Opportunity/fields/Ref_Seat_Count__c.field-meta.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Ref_Seat_Count__c</fullName>
    <externalId>false</externalId>
    <label>Seat Count</label>
    <precision>18</precision>
    <required>false</required>
    <scale>0</scale>
    <trackTrending>false</trackTrending>
    <type>Number</type>
    <unique>false</unique>
</CustomField>
```

`type` `Currency` takes the same `precision` and `scale`; `precision` is the
total digits including decimals.

## Errors you will see

| Error | Cause and fix |
|---|---|
| `Cannot specify a default value for this type` | Only Checkbox, Number, Text and similar take `defaultValue`; Date and Lookup do not. |
| `Required field is missing: length` | Text needs `length`; Number and Currency need `precision` and `scale`. |
| `Duplicate field name` or `already exists` | The org already has this API name; use the case-suffixed name you were given. |
| `Cannot set required field for Checkbox` | Checkboxes take no `required` element. |
| `relationshipLabel ... not allowed` on a User lookup | Drop `relationshipLabel` for lookups to `User`. |

After the field deploys it is visible to the integration user that deployed
it; other profiles see it only when field-level security is granted, which
the service does not do. Say so in your test steps if the tester is a
different user.
