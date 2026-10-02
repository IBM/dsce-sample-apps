# Validation rule

Source path: `force-app/main/default/objects/<Object>/validationRules/<Rule>.validationRule-meta.xml`.
`fullName` is the rule API name and must equal the file name. The formula
returns true when the record is invalid.

```xml
<!-- force-app/main/default/objects/Opportunity/validationRules/Ref_Description_Required_At_Commit.validationRule-meta.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<ValidationRule xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Ref_Description_Required_At_Commit</fullName>
    <active>true</active>
    <description>Reference example: a description is required once a deal reaches Closed Won.</description>
    <errorConditionFormula>AND(ISPICKVAL(StageName, &quot;Closed Won&quot;), ISBLANK(Description))</errorConditionFormula>
    <errorDisplayField>Description</errorDisplayField>
    <errorMessage>Add a description before closing the deal.</errorMessage>
</ValidationRule>
```

- Picklists are compared with `ISPICKVAL(Field, "Value")`, never `=`.
- Quotes inside the formula are written as `&quot;` because the formula
  sits in XML.
- `errorDisplayField` names the field the message appears next to; omit it
  to show the message at the top of the page.
- A rule that references a field you create in the same package is fine;
  a rule that references a field that does not exist fails with
  `Field <name> does not exist`.
