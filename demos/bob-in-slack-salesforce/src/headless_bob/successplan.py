"""Success Plan use case — the per-cycle artifact that Bob's approved fix
deploys (literal-spec variant): a NEW custom field on Success_Plan__c plus a
record-triggered Flow (Opportunity Closed Won → auto-create Success Plan +
bell notification). Cleanup order matters and was learned the hard way —
see `cleanup`.

Staged once per org (not per cycle): the Success_Plan__c object (team's
design) and the CustomNotificationType `Success_Plan_Created`.
"""

from datetime import UTC, date, datetime, timedelta
import logging

import httpx

LOGGER = logging.getLogger("headless_bob.successplan")
API = "/services/data/v60.0"


class SuccessPlanArtifact:
    def __init__(self, client):
        self.client = client  # headless_bob.salesforce.SalesforceClient

    # -- helpers -------------------------------------------------------------

    def _headers(self) -> dict:
        self.client._ensure_token()
        return {"Authorization": f"Bearer {self.client._token}"}

    def _refresh_if_401(self, response: httpx.Response) -> bool:
        if response.status_code == 401:
            self.client._token = None
            self.client._ensure_token()
            return True
        return False

    @property
    def base(self) -> str:
        self.client._ensure_token()
        return self.client._instance

    def _tooling(self) -> str:
        return f"{self.base}{API}/tooling"

    def _tq(self, soql: str) -> list[dict]:
        r = httpx.get(f"{self._tooling()}/query", params={"q": soql},
                      headers=self._headers(), timeout=30)
        r.raise_for_status()
        return r.json().get("records", [])

    @staticmethod
    def _reopen_body() -> dict:
        # Closing as Won moves CloseDate to today; restore a future date so the
        # re-opened deal doesn't look overdue on the projected screen.
        return {"StageName": "Qualification",
                "CloseDate": (date.today() + timedelta(days=90)).isoformat()}

    @staticmethod
    def _n(case_number: str) -> str:
        return case_number.lstrip("0") or case_number

    def field_name(self, case_number: str) -> str:
        return f"Target_Go_Live_{self._n(case_number)}__c"

    def flow_name(self, case_number: str) -> str:
        return f"Create_Success_Plan_{self._n(case_number)}"

    # -- deploy --------------------------------------------------------------

    def deploy(self, case_number: str) -> dict:
        """Create the field, deploy + activate the Flow. Returns artifact info
        (persist it; cleanup needs deployed_at)."""
        field = self.field_name(case_number)
        flow = self.flow_name(case_number)
        headers = self._headers()
        body = {"FullName": f"Success_Plan__c.{field}",
                "Metadata": {"label": f"Target Go-Live (case {self._n(case_number)})", "type": "Date"}}
        r = httpx.post(f"{self._tooling()}/sobjects/CustomField", headers=headers, timeout=60, json=body)
        if self._refresh_if_401(r):
            headers = self._headers()
            r = httpx.post(f"{self._tooling()}/sobjects/CustomField", headers=headers, timeout=60, json=body)
        if r.status_code >= 300:
            raise RuntimeError(f"field create failed: {r.text[:200]}")
        for p in self.client._soql("SELECT Id FROM PermissionSet WHERE IsOwnedByProfile = true "
                                   "AND Profile.Name = 'System Administrator'"):
            httpx.post(f"{self.base}{API}/sobjects/FieldPermissions", headers=headers, timeout=30,
                       json={"ParentId": p["Id"], "SobjectType": "Success_Plan__c",
                             "Field": f"Success_Plan__c.{field}",
                             "PermissionsRead": True, "PermissionsEdit": True})
        notif = self._tq("SELECT Id FROM CustomNotificationType "
                         "WHERE DeveloperName = 'Success_Plan_Created'")
        if not notif:
            raise RuntimeError("CustomNotificationType Success_Plan_Created is not staged in this org")
        r = httpx.post(f"{self._tooling()}/sobjects/Flow", headers=headers, timeout=120,
                       json={"FullName": flow,
                             "Metadata": self._flow_metadata(case_number, field, notif[0]["Id"])})
        if r.status_code >= 300:
            raise RuntimeError(f"flow create failed: {r.text[:300]}")
        fd = self._tq(f"SELECT Id, LatestVersion.VersionNumber FROM FlowDefinition "
                      f"WHERE DeveloperName = '{flow}'")[0]
        r = httpx.patch(f"{self._tooling()}/sobjects/FlowDefinition/{fd['Id']}", headers=headers,
                        timeout=60, json={"Metadata": {"activeVersionNumber":
                                                       fd["LatestVersion"]["VersionNumber"]}})
        if r.status_code >= 300:
            raise RuntimeError(f"flow activate failed: {r.text[:200]}")
        return {"field": field, "flow": flow, "flow_definition_id": fd["Id"],
                "deployed_at": datetime.now(UTC).isoformat()}

    def _flow_metadata(self, case_number: str, field: str, notif_type_id: str) -> dict:
        return {
            "label": f"Create Success Plan (case {self._n(case_number)})",
            "processType": "AutoLaunchedFlow", "apiVersion": 60,
            "description": f"Deployed by Bob — case {case_number}. Auto-removed on case close.",
            "start": {"locationX": 50, "locationY": 0, "triggerType": "RecordAfterSave",
                      "recordTriggerType": "CreateAndUpdate", "object": "Opportunity",
                      "filterLogic": "and",
                      "filters": [{"field": "IsWon", "operator": "EqualTo",
                                   "value": {"booleanValue": True}}],
                      "doesRequireRecordChangedToMeetCriteria": True,
                      "connector": {"targetReference": "Add_Recipient"}},
            "variables": [{"name": "RecipientIds", "dataType": "String", "isCollection": True,
                           "isInput": False, "isOutput": False}],
            "assignments": [{"name": "Add_Recipient", "label": "Add owner to recipients",
                             "locationX": 50, "locationY": 50,
                             "assignmentItems": [{"assignToReference": "RecipientIds",
                                                  "operator": "Add",
                                                  "value": {"elementReference": "$Record.OwnerId"}}],
                             "connector": {"targetReference": "Create_SP"}}],
            "recordCreates": [{"name": "Create_SP", "label": "Create Success Plan",
                               "locationX": 50, "locationY": 200, "object": "Success_Plan__c",
                               "storeOutputAutomatically": True,
                               "inputAssignments": [
                                   {"field": "Opportunity__c", "value": {"elementReference": "$Record.Id"}},
                                   {"field": "Account__c", "value": {"elementReference": "$Record.AccountId"}},
                                   {"field": "Account_Executive__c", "value": {"elementReference": "$Record.OwnerId"}},
                                   {"field": "Success_Status__c", "value": {"stringValue": "Draft"}},
                                   {"field": field, "value": {"elementReference": "$Flow.CurrentDate"}}],
                               "connector": {"targetReference": "Notify_Owner"}}],
            "actionCalls": [{"name": "Notify_Owner", "label": "Notify owner",
                             "locationX": 50, "locationY": 350,
                             "actionName": "customNotificationAction",
                             "actionType": "customNotificationAction",
                             "inputParameters": [
                                 {"name": "customNotifTypeId", "value": {"stringValue": notif_type_id}},
                                 {"name": "recipientIds", "value": {"elementReference": "RecipientIds"}},
                                 {"name": "title", "value": {"stringValue": "Success Plan created"}},
                                 {"name": "body", "value": {"stringValue":
                                     f"A Success Plan was auto-created for your closed Opportunity. "
                                     f"[Deployed by Bob — case {case_number}]"}},
                                 {"name": "targetId", "value": {"elementReference": "Create_SP"}}]}],
        }

    # -- links for the verify message --------------------------------------

    def links(self, artifact: dict, opp_name: str | None = None) -> dict:
        b = self.base
        out = {"flow": f"{b}/lightning/setup/Flows/home",
               "success_plans": f"{b}/lightning/o/Success_Plan__c/list?filterName=All",
               "opportunities": f"{b}/lightning/o/Opportunity/list",
               "opportunity": None, "opportunity_name": opp_name}
        if artifact.get("flow_definition_id"):
            out["flow"] = f"{b}/lightning/setup/Flows/page?address=%2F{artifact['flow_definition_id']}"
        if opp_name:
            try:
                rows = self.client._soql(f"SELECT Id FROM Opportunity WHERE Name = '{opp_name}' LIMIT 1")
                if rows:
                    out["opportunity"] = f"{b}/lightning/r/Opportunity/{rows[0]['Id']}/view"
            except Exception:
                LOGGER.exception("opportunity lookup failed")
        return out

    def record_link(self, sp_id: str) -> str:
        return f"{self.base}/lightning/r/Success_Plan__c/{sp_id}/view"

    def created_since(self, deployed_at: str) -> list[dict]:
        ts = (deployed_at or "1970-01-01T00:00:00+00:00").replace("+00:00", "Z")
        return self.client._soql("SELECT Id, Name, Opportunity__r.Name FROM Success_Plan__c "
                                 f"WHERE CreatedDate >= {ts} ORDER BY CreatedDate DESC")

    # -- cleanup -------------------------------------------------------------

    def cleanup(self, case_number: str, artifact: dict, opp_name: str | None = None) -> list[str]:
        """Reset everything this cycle touched. Returns a list of errors."""
        errors: list[str] = []
        # 0. The sample Opportunity always goes back to Qualification, even if
        #    the Flow never created a record (staff closed it before deploy, etc.).
        if opp_name:
            try:
                for opp in self.client._soql(f"SELECT Id, StageName FROM Opportunity WHERE Name = '{opp_name}'"):
                    if opp["StageName"].startswith("Closed"):
                        self.client._patch(f"{API}/sobjects/Opportunity/{opp['Id']}",
                                           self._reopen_body())
            except Exception as exc:
                errors.append(f"opp reset: {exc}")
        headers = self._headers()
        tooling = self._tooling()
        deployed_at = artifact.get("deployed_at") or "1970-01-01T00:00:00+00:00"
        # 1. Success Plans created by this cycle's flow → re-open their deals, delete them.
        try:
            sps = self.client._soql("SELECT Id, Opportunity__c FROM Success_Plan__c "
                                    f"WHERE CreatedDate >= {deployed_at.replace('+00:00', 'Z')}")
            for sp in sps:
                if sp.get("Opportunity__c"):
                    self.client._patch(f"{API}/sobjects/Opportunity/{sp['Opportunity__c']}",
                                       self._reopen_body())
                self.client._delete(f"{API}/sobjects/Success_Plan__c/{sp['Id']}")
        except Exception as exc:
            errors.append(f"records: {exc}")
        # 2. Flow: deactivate → drop error interviews → delete versions (definition follows).
        flow = artifact.get("flow") or self.flow_name(case_number)
        try:
            fd = self._tq(f"SELECT Id FROM FlowDefinition WHERE DeveloperName = '{flow}'")
            if fd:
                httpx.patch(f"{tooling}/sobjects/FlowDefinition/{fd[0]['Id']}", headers=headers,
                            timeout=60, json={"Metadata": {"activeVersionNumber": 0}})
                for iv in self.client._soql("SELECT Id FROM FlowInterview WHERE InterviewStatus = 'Error'"):
                    self.client._delete(f"{API}/sobjects/FlowInterview/{iv['Id']}")
                for fl in self._tq(f"SELECT Id FROM Flow WHERE DefinitionId = '{fd[0]['Id']}'"):
                    r = httpx.delete(f"{tooling}/sobjects/Flow/{fl['Id']}", headers=headers, timeout=60)
                    if r.status_code >= 300:
                        errors.append(f"flow version delete: {r.text[:120]}")
        except Exception as exc:
            errors.append(f"flow: {exc}")
        # 3. Field: perms first, then Metadata SOAP delete (Tooling REST refuses).
        field = artifact.get("field") or self.field_name(case_number)
        try:
            exists = self._tq("SELECT Id FROM CustomField WHERE DeveloperName = "
                              f"'{field.removesuffix('__c')}'")
        except Exception:
            exists = [None]   # unknown: attempt the delete anyway
        if not exists:
            if errors:
                LOGGER.warning("successplan cleanup issues (case %s): %s", case_number, "; ".join(errors))
            return errors   # nothing was deployed for this case
        try:
            for p in self.client._soql("SELECT Id FROM FieldPermissions "
                                       f"WHERE Field = 'Success_Plan__c.{field}'"):
                self.client._delete(f"{API}/sobjects/FieldPermissions/{p['Id']}")
            envelope = (
                '<?xml version="1.0" encoding="UTF-8"?>'
                '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" '
                'xmlns:met="http://soap.sforce.com/2006/04/metadata">'
                f'<soapenv:Header><met:SessionHeader><met:sessionId>{self.client._token}'
                '</met:sessionId></met:SessionHeader></soapenv:Header>'
                '<soapenv:Body><met:deleteMetadata><met:type>CustomField</met:type>'
                f'<met:fullNames>Success_Plan__c.{field}</met:fullNames>'
                '</met:deleteMetadata></soapenv:Body></soapenv:Envelope>')
            r = httpx.post(f"{self.base}/services/Soap/m/60.0", content=envelope, timeout=60,
                           headers={"Content-Type": "text/xml; charset=UTF-8",
                                    "SOAPAction": "deleteMetadata"})
            if "<success>true</success>" not in r.text:
                errors.append(f"field delete: {r.text[:160]}")
        except Exception as exc:
            errors.append(f"field: {exc}")
        if errors:
            LOGGER.warning("successplan cleanup issues (case %s): %s", case_number, "; ".join(errors))
        return errors
