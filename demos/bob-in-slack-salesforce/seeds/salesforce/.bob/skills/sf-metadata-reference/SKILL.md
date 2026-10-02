---
name: sf-metadata-reference
description: >-
  Exact, validated Salesforce metadata XML for the components this service can
  deploy: record-triggered Flows, custom fields, validation rules and Apex
  classes with tests. Use whenever you write or fix files under
  force-app/main/default. Every example here was validated against a live org
  with the same checkOnly deployment the service runs on your package, so copy
  the element order and shapes as written. Do NOT use for solution design or
  trade-off discussions (use sf-flow-developer or sf-architect-declarative).
metadata:
  disable-model-invocation: false
---

# Salesforce metadata reference

You write source-format metadata; the service converts, validates and deploys
it. Salesforce validates against an XML schema, and the errors it returns are
quoted in this skill next to the shape that avoids them.

## Read the file for what you are writing

| You are writing | Read |
|---|---|
| a Flow (record-triggered, autolaunched) | `flow.md` |
| a custom field on any object | `custom-field.md` |
| a validation rule | `validation-rule.md` |
| an Apex class, trigger or test | `apex-class.md` |

Read the file before writing the component. When a validation error names an
element, find that element here and copy its shape.

## Rules that apply to every file

- **Paths**: `force-app/main/default/flows/<Name>.flow-meta.xml`,
  `objects/<Object>/fields/<Field__c>.field-meta.xml`,
  `objects/<Object>/validationRules/<Rule>.validationRule-meta.xml`,
  `classes/<Name>.cls` with `classes/<Name>.cls-meta.xml`.
- **Element order matters.** Salesforce's parser is sequence-sensitive. Inside
  every element, put `name`, `label`, `locationX`, `locationY` first (where
  they exist), then the remaining children in alphabetical order. At the top
  level of a Flow, the elements are alphabetical too (`actionCalls`,
  `apiVersion`, `assignments`, `decisions`, ... `start`, `status`,
  `variables`). The error for a misplaced element is
  `Element {...}<name> invalid at this location in type Flow`.
- **API version**: `60.0` in every `apiVersion` element and meta file.
- **Names**: API names are letters, digits and underscores, start with a
  letter, no double or trailing underscores. Custom fields and objects end in
  `__c`. The file name must equal the API name.
- **Only what exists.** Reference only objects, fields and record types that
  `describe_object` confirms, or components you create in the same package.
  A missing reference fails validation with `... isn't a valid field` or
  `... doesn't exist`.
- **Declarative first.** A Flow, a field or a validation rule beats Apex when
  it can do the job. Apex always ships with a test class in the same package.
- **Nothing runs until a person approves.** Write files, reply with what you
  wrote and how to test it, and stop. Never deploy, never run `sf`.
