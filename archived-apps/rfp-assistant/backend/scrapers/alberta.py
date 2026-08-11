import requests
from datetime import datetime

def fetch_alberta_opportunities(RfpOpportunity):

    url = "https://purchasing.alberta.ca/api/opportunity/search"

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": "https://purchasing.alberta.ca",
        "Referer": "https://purchasing.alberta.ca/search"
    }

    payload = {
        "query": "", # text_phrase
        "limit": 100,
        "offset": 0,
        "filter": {
            "solicitationNumber": "",
            "categories": [],
            "statuses": [],
            "agreementTypes": [],
            "solicitationTypes": [],
            "opportunityTypes": [],
            "deliveryRegions": [],
            "deliveryRegion": "",
            "organizations": [],
            "unspsc": [],
            "postDateRange": "$$custom",
            "closeDateRange": "$$custom",
            "onlyBookmarked": False,
            "onlyInterestExpressed": False
        },
        "sortOptions": [
            {
                "field": "PostDateTime",
                "direction": "desc"
            }
        ]
    }

    # Send POST request
    response = requests.post(url, json=payload, headers=headers)

    data = list()
    if response.ok:
        data = response.json()['values']
    else:
        print(f"Error {response.status_code}: {response.text}")

    opportunities = list()
    if data:
        # print(data[:1])
        for item in data:
            opportunities.append(RfpOpportunity(
                title=item["title"],
                description="Description: {}\n\nCategories: {}".format(item["projectDescription"], ", ".join(item["commodityCodeTitles"])),
                customer=item["contractingOrganization"],
                ref_number=item["referenceNumber"],
                posting_url="https://purchasing.alberta.ca/posting/{}".format(item["referenceNumber"]),
                region_of_delivery=item["regionOfDelivery"],
                posting_date=item["postDateTime"],
                closing_date=item["closeDateTime"],
            ))

    return opportunities


# Testing
if __name__ == "__main__":
    from pydantic import BaseModel
    class RfpOpportunity(BaseModel):
        title: str
        description: str
        customer: str
        ref_number: str
        posting_url: str
        region_of_delivery: list
        posting_date: datetime | None
        closing_date: datetime | None
        match_score: float = 0.0

    opportunities = fetch_alberta_opportunities(RfpOpportunity)
    print(len(opportunities))
    print(opportunities[:1])
