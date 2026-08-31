import requests
from datetime import datetime

def fetch_ariba_opportunities(RfpOpportunity):

    # URL for the Ariba RFP search endpoint
    url = "https://service.ariba.com/Network/discoveryweb/search/public/v1/doIndexedSearch?siteName=Quote"

    # Request headers (mimicking a real browser)
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "Origin": "https://portal.us.bn.cloud.ariba.com",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0",
    }

    # JSON payload to search RFQs
    payload = {
        "pageSize": 100,
        "pageNum": 0,
        "shipToOrServiceLocation": "",
        "searchText": "", # category_code
        "sortBy": "NEWEST", # or, RESPONSE_DEAD_LINE or, PROJECT_AMOUNT_HIGH_TO_LOW
        "searchType": "Quote",
        "filters": [
            {
                "filterField": "RFX_TYPE",
                "filterFieldValue": "RFQ"
            }
        ],
        "companyName": None,
        "exactSearch": False,
        "postingIds": ""
    }

    
    response = requests.post(url, headers=headers, json=payload)

    data = list()
    if response.ok:
        data = response.json()['solarRecords']
    else:
        print(f"Error {response.status_code}: {response.text}")

    opportunities = list()
    if data:
        # print(data[:1])
        for item in data:
            opportunities.append(RfpOpportunity(
                title=item["title"],
                description="Description: {}\n\nCategories: {}".format("", ", ".join(item["productsAndServicesCategories"])),
                customer=item["customerName"],
                ref_number=item["rfxID"],
                posting_url="https://service.ariba.com/Discovery.aw/ad/viewRFX?id={}".format(item["rfxID"]),
                region_of_delivery=item["shipToOrServiceLocations"],
                posting_date=item["datePosted"],
                closing_date=item["endDate"],
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

    opportunities = fetch_ariba_opportunities(RfpOpportunity)
    print(len(opportunities))
    print(opportunities[:1])
