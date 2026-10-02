# Apex class and test

Two files per class: `force-app/main/default/classes/<Name>.cls` and
`classes/<Name>.cls-meta.xml`. Every class you write ships with a test class
in the same package. The service runs your tests during validation
(`RunSpecifiedTests`), and Salesforce requires the tests to cover at least
75% of each class in the package, so the test must exercise the real code
paths.

## Class

```apex
// force-app/main/default/classes/Ref_OpportunityService.cls
public with sharing class Ref_OpportunityService {
    // Reference example: the follow-up date for a won deal.
    public static Date followUpDate(Opportunity opp) {
        if (opp == null || opp.CloseDate == null) {
            return Date.today().addDays(7);
        }
        return opp.CloseDate.addDays(7);
    }
}
```

```xml
<!-- force-app/main/default/classes/Ref_OpportunityService.cls-meta.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>60.0</apiVersion>
    <status>Active</status>
</ApexClass>
```

## Test

```apex
// force-app/main/default/classes/Ref_OpportunityServiceTest.cls
@isTest
private class Ref_OpportunityServiceTest {
    @isTest
    static void followUpIsSevenDaysAfterClose() {
        Opportunity opp = new Opportunity(Name = 'Ref deal', StageName = 'Prospecting',
                                          CloseDate = Date.newInstance(2026, 1, 10));
        insert opp;
        System.assertEquals(Date.newInstance(2026, 1, 17), Ref_OpportunityService.followUpDate(opp));
        System.assertEquals(Date.today().addDays(7), Ref_OpportunityService.followUpDate(null));
    }
}
```

```xml
<!-- force-app/main/default/classes/Ref_OpportunityServiceTest.cls-meta.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>60.0</apiVersion>
    <status>Active</status>
</ApexClass>
```

## Rules

- The test class is annotated `@isTest` and creates its own data; never
  `SeeAllData=true`.
- Required fields when inserting standard records in a test: Opportunity
  needs `Name`, `StageName`, `CloseDate`; Account needs `Name`; Contact needs
  `LastName`.
- A trigger goes in `force-app/main/default/triggers/<Name>.trigger` with a
  `<Name>.trigger-meta.xml` whose root is `ApexTrigger`; keep triggers thin
  and put logic in a class.
- Coverage errors read `Average test coverage across all Apex Classes and
  Triggers is N%, at least 75% test coverage is required`; add assertions
  that reach the uncovered branches.
