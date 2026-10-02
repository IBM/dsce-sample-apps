# Flow

Source path: `force-app/main/default/flows/<Name>.flow-meta.xml`. One file is
the whole Flow. The example below is a complete, validated after-save Flow on
Opportunity: when a deal is won it creates a Task, adds the owner to a
recipient list, looks up a custom notification type, and sends the owner an
in-app notification if the type exists. Every element type you are likely to
need is in it; take what you need and keep the order.

## Complete example

```xml
<!-- force-app/main/default/flows/Ref_Opportunity_Won_Task.flow-meta.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <actionCalls>
        <name>Notify_Owner</name>
        <label>Notify owner</label>
        <locationX>176</locationX>
        <locationY>758</locationY>
        <actionName>customNotificationAction</actionName>
        <actionType>customNotificationAction</actionType>
        <flowTransactionModel>CurrentTransaction</flowTransactionModel>
        <inputParameters>
            <name>customNotifTypeId</name>
            <value>
                <elementReference>Get_Notification_Type.Id</elementReference>
            </value>
        </inputParameters>
        <inputParameters>
            <name>recipientIds</name>
            <value>
                <elementReference>RecipientIds</elementReference>
            </value>
        </inputParameters>
        <inputParameters>
            <name>title</name>
            <value>
                <stringValue>Follow-up task created</stringValue>
            </value>
        </inputParameters>
        <inputParameters>
            <name>body</name>
            <value>
                <stringValue>A follow-up task was created for your won opportunity.</stringValue>
            </value>
        </inputParameters>
        <inputParameters>
            <name>targetId</name>
            <value>
                <elementReference>Create_Task</elementReference>
            </value>
        </inputParameters>
    </actionCalls>
    <apiVersion>60.0</apiVersion>
    <assignments>
        <name>Add_Recipient</name>
        <label>Add owner to recipients</label>
        <locationX>176</locationX>
        <locationY>350</locationY>
        <assignmentItems>
            <assignToReference>RecipientIds</assignToReference>
            <operator>Add</operator>
            <value>
                <elementReference>$Record.OwnerId</elementReference>
            </value>
        </assignmentItems>
        <connector>
            <targetReference>Get_Notification_Type</targetReference>
        </connector>
    </assignments>
    <decisions>
        <name>Has_Notification_Type</name>
        <label>Has notification type?</label>
        <locationX>176</locationX>
        <locationY>650</locationY>
        <defaultConnectorLabel>No type configured</defaultConnectorLabel>
        <rules>
            <name>Type_Found</name>
            <conditionLogic>and</conditionLogic>
            <conditions>
                <leftValueReference>Get_Notification_Type</leftValueReference>
                <operator>IsNull</operator>
                <rightValue>
                    <booleanValue>false</booleanValue>
                </rightValue>
            </conditions>
            <connector>
                <targetReference>Notify_Owner</targetReference>
            </connector>
            <label>Type found</label>
        </rules>
    </decisions>
    <description>Reference example: when an Opportunity is won, create a follow-up Task and notify the owner.</description>
    <environments>Default</environments>
    <formulas>
        <name>Due_Date</name>
        <dataType>Date</dataType>
        <expression>{!$Record.CloseDate} + 7</expression>
    </formulas>
    <interviewLabel>Ref Opportunity Won Task {!$Flow.CurrentDateTime}</interviewLabel>
    <label>Ref: Opportunity won creates task</label>
    <processMetadataValues>
        <name>BuilderType</name>
        <value>
            <stringValue>LightningFlowBuilder</stringValue>
        </value>
    </processMetadataValues>
    <processMetadataValues>
        <name>CanvasMode</name>
        <value>
            <stringValue>AUTO_LAYOUT_CANVAS</stringValue>
        </value>
    </processMetadataValues>
    <processType>AutoLaunchedFlow</processType>
    <recordCreates>
        <name>Create_Task</name>
        <label>Create follow-up task</label>
        <locationX>176</locationX>
        <locationY>200</locationY>
        <connector>
            <targetReference>Add_Recipient</targetReference>
        </connector>
        <inputAssignments>
            <field>ActivityDate</field>
            <value>
                <elementReference>Due_Date</elementReference>
            </value>
        </inputAssignments>
        <inputAssignments>
            <field>OwnerId</field>
            <value>
                <elementReference>$Record.OwnerId</elementReference>
            </value>
        </inputAssignments>
        <inputAssignments>
            <field>Subject</field>
            <value>
                <stringValue>Kick off onboarding</stringValue>
            </value>
        </inputAssignments>
        <inputAssignments>
            <field>WhatId</field>
            <value>
                <elementReference>$Record.Id</elementReference>
            </value>
        </inputAssignments>
        <object>Task</object>
        <storeOutputAutomatically>true</storeOutputAutomatically>
    </recordCreates>
    <recordLookups>
        <name>Get_Notification_Type</name>
        <label>Get notification type</label>
        <locationX>176</locationX>
        <locationY>500</locationY>
        <assignNullValuesIfNoRecordsFound>false</assignNullValuesIfNoRecordsFound>
        <connector>
            <targetReference>Has_Notification_Type</targetReference>
        </connector>
        <filterLogic>and</filterLogic>
        <filters>
            <field>DeveloperName</field>
            <operator>EqualTo</operator>
            <value>
                <stringValue>Success_Plan_Created</stringValue>
            </value>
        </filters>
        <getFirstRecordOnly>true</getFirstRecordOnly>
        <object>CustomNotificationType</object>
        <storeOutputAutomatically>true</storeOutputAutomatically>
    </recordLookups>
    <start>
        <locationX>50</locationX>
        <locationY>0</locationY>
        <connector>
            <targetReference>Create_Task</targetReference>
        </connector>
        <doesRequireRecordChangedToMeetCriteria>true</doesRequireRecordChangedToMeetCriteria>
        <filterLogic>and</filterLogic>
        <filters>
            <field>IsWon</field>
            <operator>EqualTo</operator>
            <value>
                <booleanValue>true</booleanValue>
            </value>
        </filters>
        <object>Opportunity</object>
        <recordTriggerType>CreateAndUpdate</recordTriggerType>
        <triggerType>RecordAfterSave</triggerType>
    </start>
    <status>Active</status>
    <variables>
        <name>RecipientIds</name>
        <dataType>String</dataType>
        <isCollection>true</isCollection>
        <isInput>false</isInput>
        <isOutput>false</isOutput>
    </variables>
</Flow>
```

## Element by element

- **`start`** is the trigger. `triggerType` is `RecordAfterSave` (create
  related records, send notifications) or `RecordBeforeSave` (set fields on
  the same record, no related records, no actions). `recordTriggerType` is
  `Create`, `Update`, `CreateAndUpdate` or `Delete`. `filters` on the
  triggering record with `doesRequireRecordChangedToMeetCriteria` true means
  "fire when the record starts meeting the criteria", which is what "when it
  becomes Closed Won" means. Reference the triggering record as `$Record`.
- **`recordCreates`** creates one record. `inputAssignments` are field
  values, and only fields `describe_object` marks `"writable": true` may
  appear there: an auto-number `Name`, a formula or a system field makes
  the Flow fail at run time, after validation passed. `storeOutputAutomatically`
  true makes the new record's Id available as `{!Create_Task}` (the element
  name) for later elements.
- **`recordLookups`** is Get Records. `getFirstRecordOnly` true plus
  `storeOutputAutomatically` true gives one record you reference as
  `Get_Notification_Type.Id`. Check the element itself with `IsNull` in a
  decision before using it.
- **`decisions`** branch on `rules`; each rule has `conditions` and a
  `connector`. A rule with no matching connector falls to the default
  outcome, which continues to the element named in `defaultConnector` or ends
  the path if there is none.
- **`assignments`** set or add to variables. The `Add` operator appends to a
  collection.
- **`formulas`** are named expressions with a `dataType`; reference them by
  name like any variable.
- **`actionCalls`** invoke actions. The custom notification action is
  `actionName` and `actionType` both `customNotificationAction`, with the
  five inputs shown: `customNotifTypeId`, `recipientIds` (a text collection
  of user Ids), `title`, `body`, `targetId` (the record the notification
  opens). Get the type Id with a `recordLookups` on `CustomNotificationType`
  by `DeveloperName`; never hardcode an Id.
- **`variables`** declare typed values. A collection is `isCollection` true.
- **`status`** `Active` deploys the Flow active. `Draft` deploys it inactive.
- **`processType`** is `AutoLaunchedFlow` for every record-triggered and
  autolaunched Flow. Screen flows are `Flow`.

## Errors you will see, and the shape that avoids them

| Error | Cause and fix |
|---|---|
| `Element {…}customNotifications invalid at this location in type Flow` | There is no `customNotifications` element. A notification is an `actionCalls` element with `actionType` `customNotificationAction`. |
| `'customNotification' is not a valid value for the enum 'InvocableActionType'` | The action type is `customNotificationAction`, in both `actionName` and `actionType`. |
| `The value field isn't supported when isCollection is set to true and dataType is "Text"` | A collection variable takes no `value`. Declare it empty and fill it with an `assignments` element using the `Add` operator. |
| `Element {…}<x> invalid at this location` | Element order. Children after `name`, `label`, `locationX`, `locationY` go alphabetically; top-level Flow elements go alphabetically. |
| `The element "X" isn't connected` or an unreachable element | Every element except the last needs a `connector`, and the `start` element must connect to the first one. |
| `field "X" isn't a valid field` on `$Record` or an `inputAssignments` | Confirm the API name with `describe_object`; standard lookups end in `Id` (`OwnerId`, `AccountId`), custom ones in `__c`. |
| `field integrity exception: unknown (The field "OwnerId" for the object "X" doesn't exist.)` | Assign only fields that `describe_object` lists for that object. A custom object that is the detail side of a master-detail relationship has no `OwnerId`; its owner is the master record's. Leave the assignment out. |
| At run time: `INVALID_FIELD_FOR_INSERT_UPDATE: Unable to create/update fields: Name` | Validation cannot catch this one; the Flow fails when it runs and the user's save is refused. `Name` on that object is an auto-number (`describe_object` shows `"autoNumber": true`, `"writable": false`); Salesforce sets it. Assign only fields with `"writable": true`. Same for formula and system fields. |
| `Flow name must be unique` | Another Flow already has this API name; use the case-suffixed name you were given. |

## Not in this example

- Before-save field updates: `triggerType` `RecordBeforeSave` with a
  `recordUpdates` element whose `inputReference` is `$Record` and no
  `filters` on the update itself.
- Scheduled paths, loops and screens are outside what this service deploys
  from chat; if the proposal needs them, say so in your reply instead of
  guessing.
